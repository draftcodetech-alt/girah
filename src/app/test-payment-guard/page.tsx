// TEMP TEST PAGE — Phase 8.4 fake-payment guard verification only. Deleted after this task.
import { markCodPaymentReceived } from "@/modules/admin/orders";

export default function TestPaymentGuardPage() {
  async function run(formData: FormData) {
    "use server";
    const orderId = formData.get("orderId") as string;
    const result = await markCodPaymentReceived(orderId);
    console.log("markCodPaymentReceived result:", result);
  }

  return (
    <form action={run}>
      <input name="orderId" placeholder="Paste Safepay order ID here" style={{ width: 400 }} />
      <button type="submit">Try to mark it paid</button>
    </form>
  );
}
