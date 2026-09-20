import Safepay from "@sfpy/node-core";
import axios from "axios";

const SAFEPAY_HOST = "https://sandbox.api.getsafepay.com"; // TODO: switch to https://api.getsafepay.com when going live

const safepay = new Safepay(process.env.SAFEPAY_API_SECRET!, {
  authType: "secret",
  host: SAFEPAY_HOST,
});

export type SafepayCheckoutParams = {
  orderId: string;
  amountInPaisa: number;
  redirectUrl: string;
  cancelUrl: string;
};

export async function createSafepayCheckoutUrl(params: SafepayCheckoutParams): Promise<string> {
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

  // Step B: create a short-lived auth token — DIRECT HTTP CALL, bypassing a
  // confirmed bug in @sfpy/node-core's client.passport.create() method.
  // See technical-design.md Decisions Log #19.
  const passportResponse = await axios.post(
    `${SAFEPAY_HOST}/client/passport/v1/token`,
    {},
    { headers: { "x-sfpy-merchant-secret": process.env.SAFEPAY_API_SECRET! } }
  );
  const authToken = passportResponse.data.data;

  // Step C: build the actual checkout URL — SDK confirmed working
  const checkoutUrl = safepay.checkout.createCheckoutUrl({
    env: "sandbox",
    tbt: authToken,
    tracker: trackerToken,
    source: "hosted",
    order_id: params.orderId,
    redirect_url: params.redirectUrl,
    cancel_url: params.cancelUrl,
  });

  return checkoutUrl;
}
