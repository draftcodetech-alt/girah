"use server";
import { createSafepayCheckoutUrl, isSafepayConfigured } from "@/modules/payments";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveCartIdentity } from "@/modules/cart";
import { upsertSavedShippingForUser } from "@/modules/addresses";
import { checkoutSchema, type CheckoutInput } from "./schema";
import { placeOrderCore, type PlaceOrderResult } from "./place-order";
import { sendEmailSafe } from "@/lib/email";
import { orderReceivedEmail } from "@/lib/email-templates";

export type { PlaceOrderResult };

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  // Owner spec: no guest buying — checkout is account-only, end to end. The
  // proxy already bounces /checkout; this holds the line against a direct
  // POST to the action. Resolved once here and threaded into placeOrderCore
  // and the saved-address step so there is a single session read.
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "You must be signed in." };
  }

  // Phase 17: the checkout UI hides online payment when Safepay isn't
  // configured — this server-side check keeps the action honest for stale
  // clients and direct callers (before any order row is created).
  if (data.paymentMethod === "SAFEPAY" && !isSafepayConfigured()) {
    return {
      success: false,
      error: "Online payment is not available right now. Please choose Cash on Delivery.",
    };
  }

  const identity = await resolveCartIdentity();

  const result = await placeOrderCore(data, identity, session.user.id);
  if (!result.success) return result;

  revalidatePath("/", "layout");

  // Opt-in saved address (Phase 12): same swallow-and-log rule as Safepay —
  // the order is already committed, a storage hiccup must not fail it.
  if (data.saveAddress) {
    try {
      await upsertSavedShippingForUser(session.user.id, data);
    } catch (saveError) {
      // Address fields are PII: log the failure message, never the payload.
      console.error("Failed to save shipping address:", saveError instanceof Error ? saveError.message : "unknown error");
    }
  }

  // Phase 14: order-received email — best-effort after commit, same
  // swallow-and-log rule as the saved-address and Safepay blocks: a mail
  // problem can never fail an order that already exists. Sent BEFORE the
  // Safepay URL step so it also goes out when URL generation fails.
  await sendEmailSafe(
    orderReceivedEmail({
      to: data.email,
      customerName: data.fullName,
      orderNumber: result.orderNumber,
      total: result.total,
      paymentMethod: data.paymentMethod,
      link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/order/${result.orderId}/confirmation`,
    })
  );

  if (data.paymentMethod === "SAFEPAY") {
    try {
      const checkoutUrl = await createSafepayCheckoutUrl({
        orderId: result.orderId,
        amountInPaisa: result.total,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/order/${result.orderId}/confirmation`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/order/${result.orderId}/confirmation?cancelled=1`,
      });
      return { ...result, checkoutUrl };
    } catch (safepayError) {
      // Order + stock decrement already succeeded and committed — a Safepay
      // API failure here must NOT be presented as a failed order. The
      // customer can still pay via the order's confirmation/retry path later.
      console.error("Safepay checkout URL generation failed:", safepayError);
      return result;
    }
  }

  return result;
}
