import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentHeading, PlaceholderNote } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you order from Girah — accounts, orders, payments, and handmade pieces.",
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Service">
      <PlaceholderNote>[placeholder — last updated: add the adoption date when these terms are signed off.]</PlaceholderNote>

      <p>
        By using this site or placing an order you agree to these terms. If you
        do not agree, please do not use the site.
      </p>

      <ContentHeading>Accounts</ContentHeading>
      <p>
        You are responsible for keeping your login details to yourself and for
        activity under your account. Tell us promptly if you suspect someone else
        has access — the Contact page is the fastest way to reach us.
      </p>

      <ContentHeading>Orders & pricing</ContentHeading>
      <p>
        Prices are shown in Pakistani Rupees (PKR). An order is accepted when we
        confirm it; if a piece cannot be made or is out of stock, we will tell you
        and cancel it. [placeholder — state who bears price-display errors and the
        order acceptance window the owner wants to commit to.]
      </p>

      <ContentHeading>Payment</ContentHeading>
      <p>
        You can pay in cash on delivery or online at checkout (cards, JazzCash,
        EasyPaisa) through Safepay. Online orders are only marked paid once
        Safepay confirms the payment to us.
      </p>

      <ContentHeading>Handmade pieces</ContentHeading>
      <p>
        Everything is crocheted by hand, so small variations in shape, colour, and
        size are part of the craft — no two pieces are ever exactly alike.
        Product photographs show the real item you receive.
      </p>

      <ContentHeading>Returns</ContentHeading>
      <p>
        Returns and refunds are handled under the{" "}
        <Link href="/returns" className="underline text-sage hover:text-charcoal">
          Returns & Refunds
        </Link>{" "}
        page, which forms part of these terms.
      </p>

      <ContentHeading>Liability</ContentHeading>
      <PlaceholderNote>
        [placeholder — limit-of-liability wording, disclaimers, and any warranty
        commitments must be reviewed by the owner (and ideally a lawyer) before
        this section is final.]
      </PlaceholderNote>

      <ContentHeading>Governing law</ContentHeading>
      <PlaceholderNote>
        [placeholder — governing law and courts (expected: Pakistan / the
        owner’s province) belong here once confirmed.]
      </PlaceholderNote>

      <ContentHeading>Changes & contact</ContentHeading>
      <p>
        We may update these terms; the date above will change when we do. For
        questions, use the Contact page.
      </p>
    </ContentPage>
  );
}
