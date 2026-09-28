import type { Metadata } from "next";
import { ContentPage, ContentHeading, PlaceholderNote } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description: "How returns and refunds work at Girah — request help through the contact page with your order number.",
};

export default function ReturnsPage() {
  return (
    <ContentPage title="Returns & Refunds">
      <p>
        We want you to be happy with your piece. If something is wrong with your
        order, contact us with your order number and we will sort it out.
      </p>

      <ContentHeading>When you can request a return</ContentHeading>
      <PlaceholderNote>
        [placeholder — the owner must fill in the return window (how many days
        after delivery), the condition the piece must be in, and any exclusions
        (custom/personalised pieces, etc.).]
      </PlaceholderNote>

      <ContentHeading>Damaged or wrong item</ContentHeading>
      <p>
        If your order arrives damaged or is not what you ordered, reach out as
        soon as you can with a photo — we will make it right. [placeholder —
        confirm the reporting deadline after delivery.]
      </p>

      <ContentHeading>How refunds are issued</ContentHeading>
      <p>
        Orders paid in cash are refunded in cash when a return is approved. Orders
        paid online are refunded to the original payment method through Safepay;
        [placeholder — state the number of days refunds typically take to appear
        on the customer’s statement.]
      </p>

      <ContentHeading>How to start a return</ContentHeading>
      <p>
        Use the channels on the Contact page and include your order number. Keep
        the piece and its packaging until we reply — we may ask for photos first.
      </p>
    </ContentPage>
  );
}
