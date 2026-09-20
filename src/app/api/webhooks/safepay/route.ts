import { NextRequest, NextResponse } from "next/server";
import { verifySafepaySignature } from "@/modules/payments/verify-webhook";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-sfpy-signature");

  if (!verifySafepaySignature(rawBody, signature)) {
    console.error("Safepay webhook: INVALID SIGNATURE — rejecting.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const orderId: string | undefined = event.data?.metadata?.order_id;

  if (!orderId) {
    console.error("Safepay webhook: verified but no order_id in metadata.", event);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error(`Safepay webhook: order ${orderId} not found.`, event);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Never downgrade a PAID order — confirmed necessary by a REAL test just now,
  // where the same tracker produced payment.failed then payment.succeeded
  // (an initial card decline followed by a successful retry). This also makes
  // the handler naturally idempotent: a duplicated delivery of the same event
  // just re-sets the same status, which is a safe no-op.
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === "payment.succeeded") {
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
    console.log(`Order ${order.orderNumber}: paymentStatus -> PAID`);
  } else if (event.type === "payment.failed") {
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
    console.log(`Order ${order.orderNumber}: paymentStatus -> FAILED`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
