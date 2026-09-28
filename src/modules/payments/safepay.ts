import Safepay from "@sfpy/node-core";
import axios from "axios";
import { db } from "@/lib/db";

// Phase 17: one switch for the whole integration. "sandbox" (default) hits
// sandbox.api.getsafepay.com; set SAFEPAY_ENV=live to point at the production
// API once Safepay approves the merchant account.
const SAFEPAY_ENV: "live" | "sandbox" = process.env.SAFEPAY_ENV === "live" ? "live" : "sandbox";
const SAFEPAY_HOST =
  SAFEPAY_ENV === "live" ? "https://api.getsafepay.com" : "https://sandbox.api.getsafepay.com";

export function isSafepayConfigured(): boolean {
  return Boolean(process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_API_SECRET);
}

let safepay: Safepay | null = null;

// Lazy so importing this module (checkout page, orders actions) never throws
// when the merchant account isn't configured yet — the checkout UI hides the
// payment option instead, and callers that still reach here get a clear error.
function getSafepayClient(): Safepay {
  if (!isSafepayConfigured()) {
    throw new Error(
      "Safepay is not configured (SAFEPAY_API_KEY / SAFEPAY_API_SECRET are missing)."
    );
  }
  safepay ??= new Safepay(process.env.SAFEPAY_API_SECRET!, {
    authType: "secret",
    host: SAFEPAY_HOST,
  });
  return safepay;
}

export type SafepayCheckoutParams = {
  orderId: string;
  amountInPaisa: number;
  redirectUrl: string;
  cancelUrl: string;
};

export async function createSafepayCheckoutUrl(params: SafepayCheckoutParams): Promise<string> {
  const safepay = getSafepayClient();
  // Step A: create the payment session ("tracker") — SDK confirmed working
  const sessionResponse = await safepay.payments.session.setup({
    merchant_api_key: process.env.SAFEPAY_API_KEY!,
    intent: "CYBERSOURCE",
    mode: "payment",
    entry_mode: "raw",
    currency: "PKR",
    amount: params.amountInPaisa,
    metadata: { order_id: params.orderId },
    include_fees: false,
  });
  const trackerToken = sessionResponse.data.tracker.token;

  // Phase 3: remember WHICH payment session exists for this order. The CAS
  // can never overwrite the tracker once the order is PAID/REFUNDED, so the
  // refund path always points at the session that actually captured money —
  // even if a later retry created a newer session.
  await db.order.updateMany({
    where: { id: params.orderId, paymentStatus: { in: ["PENDING", "FAILED"] } },
    data: { safepayTracker: trackerToken },
  });

  // Step B: create a short-lived auth token — DIRECT HTTP CALL, bypassing a
  // confirmed bug in @sfpy/node-core's client.passport.create() method.
  const passportResponse = await axios.post(
    `${SAFEPAY_HOST}/client/passport/v1/token`,
    {},
    { headers: { "x-sfpy-merchant-secret": process.env.SAFEPAY_API_SECRET! } }
  );
  const authToken = passportResponse.data.data;

  // Step C: build the actual checkout URL — SDK confirmed working
  const checkoutUrl = safepay.checkout.createCheckoutUrl({
    // The hosted checkout calls the live environment "production", the API
    // host calls it "live" — map our one switch onto each vocabulary.
    env: SAFEPAY_ENV === "live" ? "production" : "sandbox",
    tbt: authToken,
    tracker: trackerToken,
    source: "hosted",
    order_id: params.orderId,
    redirect_url: params.redirectUrl,
    cancel_url: params.cancelUrl,
  });

  return checkoutUrl;
}

export class SafepayRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafepayRefundError";
  }
}

/**
 * Refund a captured Safepay payment (full amount, PKR).
 *
 * Endpoint confirmed from Safepay's official SDK + docs:
 * POST /order/payments/v3/{tracker}/refund with body { currency, amount }
 * (amount in lowest denomination), authenticated with the merchant secret —
 * the same auth this module's checkout session already uses.
 *
 * Throws SafepayRefundError on ANY failure (network, HTTP error, or a 200
 * whose `status.errors` array is non-empty) so callers can refuse destructive
 * state changes when the money has not actually been returned.
 */
export async function refundSafepayPayment(
  tracker: string,
  amountInPaisa: number
): Promise<void> {
  try {
    const response: unknown = await getSafepayClient().order.cancel.refund(tracker, {
      currency: "PKR",
      amount: amountInPaisa,
    });
    // Safepay can answer 200 with a business error in `status.errors`.
    const errors = (response as { status?: { errors?: unknown[] } } | null)?.status?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      throw new SafepayRefundError(`Safepay refund rejected: ${JSON.stringify(errors)}`);
    }
  } catch (error) {
    if (error instanceof SafepayRefundError) {
      console.error(`Safepay refund rejected for tracker ${tracker}:`, error.message);
      throw error;
    }
    console.error(`Safepay refund request failed for tracker ${tracker}:`, error);
    throw new SafepayRefundError("Safepay refund request failed.");
  }
}
