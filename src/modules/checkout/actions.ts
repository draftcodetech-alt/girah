"use server";
import { createSafepayCheckoutUrl } from "@/modules/payments";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveCartIdentity } from "@/modules/cart";
import { checkoutSchema, type CheckoutInput } from "./schema";
import { placeOrderCore, type PlaceOrderResult } from "./place-order";

export type { PlaceOrderResult };

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { success: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const identity = await resolveCartIdentity();
  const session = await auth();

  const result = await placeOrderCore(data, identity, session?.user?.id);
  if (!result.success) return result;

  revalidatePath("/", "layout");

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
