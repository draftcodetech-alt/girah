import { db } from "@/lib/db";
import type { Order } from "@prisma/client";
import { verifySafepaySignature } from "./verify-webhook";
import { refundSafepayPayment } from "./safepay";

export type SafepayWebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

// Event taxonomy across Safepay API generations. The legacy
// `payment.succeeded` / `payment.failed` pair is real-test confirmed for this
// integration; the others are accepted defensively from the newer docs'
// catalog so a Safepay-side migration doesn't silently stall order status.
const SUCCESS_EVENTS = new Set(["payment.succeeded", "payment.completed", "payment.settled"]);
const FAILURE_EVENTS = new Set(["payment.failed", "payment.rejected"]);
const REFUND_EVENTS = new Set([
  "payment.refunded",
  "payment.refund_partial",
  "payment.reversed",
  "refund.completed",
]);

// Documented payload shape (safepay-docs.netlify.app webhook-types):
// { type, version, data: { tracker: "track_…", amount, currency,
//   metadata: { order_id }, … } }.
type SafepayEvent = {
  type?: unknown;
  data?: {
    tracker?: unknown;
    amount?: unknown;
    currency?: unknown;
    metadata?: { order_id?: unknown };
  } | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Full webhook pipeline, extracted from the route handler so every branch
 * (signature failure, malformed body, every event type, every guard) can be
 * integration-tested without Next request/response objects. The route only
 * supplies the raw body + signature headers.
 *
 * Contract with Safepay: always return 200 for anything we chose NOT to act
 * on (unknown type, missing order, guards) — non-2xx makes Safepay retry the
 * same delivery forever. Only signature failures return 401.
 */
export async function processSafepayWebhook(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null = null
): Promise<SafepayWebhookResult> {
  if (!verifySafepaySignature(rawBody, signatureHeader, timestampHeader)) {
    console.error("Safepay webhook: signature verification FAILED — rejecting delivery.");
    return { status: 401, body: { error: "Invalid signature" } };
  }

  let event: SafepayEvent;
  try {
    event = JSON.parse(rawBody) as SafepayEvent;
  } catch {
    // Signature was valid, body is not JSON: refuse with 400 (retriable for
    // the sender to fix; there is nothing sensible to parse).
    console.error("Safepay webhook: signature valid but body is not valid JSON — rejecting.");
    return { status: 400, body: { error: "Malformed JSON" } };
  }

  const type = asString(event.type) ?? "";
  const data = event.data && typeof event.data === "object" ? event.data : {};
  const eventTracker = asString(data.tracker);
  const orderId = asString(data.metadata?.order_id);

  // Resolve the order. Primary key is metadata.order_id (documented); the
  // fallback matches the tracker we stored at checkout — necessary because
  // real delivery of payment.failed has been observed with EMPTY metadata,
  // which would otherwise leave the order stuck in PENDING forever.
  let order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order && eventTracker) {
    order = await db.order.findFirst({ where: { safepayTracker: eventTracker } });
  }

  if (!order) {
    console.error(
      `Safepay webhook: no matching order for type="${type}" order_id=${orderId ?? "—"} tracker=${eventTracker ?? "—"}`
    );
    return { status: 200, body: { received: true } };
  }

  // Defense in depth: a signed event must never move a non-Safepay order's
  // payment status (e.g. a webhook naming a COD order).
  if (order.paymentMethod !== "SAFEPAY") {
    console.error(
      `Safepay webhook: ignoring "${type}" for non-Safepay order ${order.orderNumber}.`
    );
    return { status: 200, body: { received: true } };
  }

  if (SUCCESS_EVENTS.has(type)) return handleSuccess(order, data, eventTracker);
  if (FAILURE_EVENTS.has(type)) return handleFailure(order);
  if (REFUND_EVENTS.has(type)) return handleRefund(order);

  console.log(`Safepay webhook: unhandled event type "${type}" — acknowledged without action.`);
  return { status: 200, body: { received: true } };
}

async function handleSuccess(
  order: Order,
  data: NonNullable<SafepayEvent["data"]>,
  eventTracker: string | null
): Promise<SafepayWebhookResult> {
  // Amount & currency guard: PAID is only granted for exactly what the order
  // asked for (documented payload fields: `amount` in lowest denomination,
  // `currency` ISO code). Guards are presence-checked so a payload variant
  // without them still processes (logged limitation), but a WRONG value never
  // does.
  const amount = typeof data.amount === "number" ? data.amount : null;
  if (amount !== null && amount !== order.total) {
    console.error(
      `SAFEPAY WEBHOOK AMOUNT MISMATCH — order ${order.orderNumber} expects ${order.total} paisa, event says ${amount}. NOT marking PAID.`
    );
    return { status: 200, body: { received: true } };
  }
  const currency = asString(data.currency);
  if (currency !== null && currency.toUpperCase() !== "PKR") {
    console.error(
      `SAFEPAY WEBHOOK CURRENCY MISMATCH — order ${order.orderNumber} expects PKR, event says ${currency}. NOT marking PAID.`
    );
    return { status: 200, body: { received: true } };
  }

  // Late success for an order the admin already cancelled: the money was
  // captured AFTER we released the stock. Refund it on the spot; if the
  // refund fails, record PAID (truthful: we hold the money) and leave a
  // CRITICAL log so an admin refunds from the Safepay dashboard.
  if (order.orderStatus === "CANCELLED") {
    const tracker = eventTracker ?? order.safepayTracker;
    let refunded = false;
    if (tracker) {
      try {
        await refundSafepayPayment(tracker, order.total);
        refunded = true;
      } catch (error) {
        console.error(
          `CRITICAL: order ${order.orderNumber} received payment AFTER cancellation and the auto-refund FAILED (${tracker}). Refund manually in the Safepay dashboard.`,
          error
        );
      }
    } else {
      console.error(
        `CRITICAL: order ${order.orderNumber} received payment AFTER cancellation but no tracker is known — refund manually in the Safepay dashboard.`
      );
    }
    const claimed = await db.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: { notIn: ["PAID", "REFUNDED"] },
      },
      data: { paymentStatus: refunded ? "REFUNDED" : "PAID" },
    });
    console.log(
      `Order ${order.orderNumber}: late payment on CANCELLED order -> ${claimed.count === 0 ? "already resolved (no-op)" : refunded ? "REFUNDED (auto-refund)" : "PAID (manual refund required!)"}`
    );
    return { status: 200, body: { received: true } };
  }

  // Normal path: CAS so we never downgrade PAID/REFUNDED (real-test history:
  // the same tracker emitted payment.failed then payment.succeeded) and so a
  // duplicated delivery is an idempotent no-op. Also refreshes the stored
  // tracker with the authoritative `data.tracker` — only inside this CAS, so
  // a post-PAID session can never overwrite the refund target.
  const claimed = await db.order.updateMany({
    where: { id: order.id, paymentStatus: { notIn: ["PAID", "REFUNDED"] } },
    data: {
      paymentStatus: "PAID",
      ...(eventTracker ? { safepayTracker: eventTracker } : {}),
    },
  });
  console.log(
    `Order ${order.orderNumber}: paymentStatus -> PAID${claimed.count === 0 ? " (duplicate/late delivery — no-op)" : ""}`
  );
  return { status: 200, body: { received: true } };
}

async function handleFailure(order: Order): Promise<SafepayWebhookResult> {
  // PENDING -> FAILED only. A FAILED event arriving AFTER success (the
  // observed decline-then-retry sequence) must not undo PAID, and a duplicate
  // FAILED delivery must not re-fire anything.
  const claimed = await db.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING" },
    data: { paymentStatus: "FAILED" },
  });
  console.log(
    `Order ${order.orderNumber}: paymentStatus -> FAILED${claimed.count === 0 ? " (order already past PENDING — no-op)" : ""}`
  );
  return { status: 200, body: { received: true } };
}

async function handleRefund(order: Order): Promise<SafepayWebhookResult> {
  // PAID -> REFUNDED only. Deliberately does NOT restock: stock is credited
  // exclusively by the cancel flow, so a refund can never double-credit it.
  const claimed = await db.order.updateMany({
    where: { id: order.id, paymentStatus: "PAID" },
    data: { paymentStatus: "REFUNDED" },
  });
  console.log(
    `Order ${order.orderNumber}: paymentStatus -> REFUNDED${claimed.count === 0 ? " (not PAID — duplicate or premature refund event, no-op)" : ""}`
  );
  return { status: 200, body: { received: true } };
}
