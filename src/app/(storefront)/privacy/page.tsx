import type { Metadata } from "next";
import { ContentPage, ContentHeading, PlaceholderNote } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Girah collects, why, and the choices you have — orders, account details, and cookies.",
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy">
      <PlaceholderNote>[placeholder — last updated: add the adoption date when this policy is signed off.]</PlaceholderNote>

      <p>
        This policy explains what information Girah collects when you use this
        site, why we collect it, and what you can do about it.
      </p>

      <ContentHeading>What we collect</ContentHeading>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong>Account details</strong> — your name and email address when you
          create an account, plus the password (stored only as a salted hash).
        </li>
        <li>
          <strong>Order details</strong> — recipient name, phone, address, delivery
          notes, and the contents of orders you place (guest or account).
        </li>
        <li>
          <strong>Saved shipping address</strong> — only if you tick the “save”
          box at checkout while signed in.
        </li>
        <li>
          <strong>Wishlist</strong> — the products you save while signed in.
        </li>
        <li>
          <strong>Session cookies</strong> — to keep you signed in and to keep
          your cart between visits. No third-party analytics or advertising
          trackers run on this site.
        </li>
      </ul>

      <ContentHeading>How we use it</ContentHeading>
      <p>
        To take and deliver orders, send transactional emails (order confirmation,
        welcome, password resets), prevent fraud and abuse (for example, limiting
        repeated failed sign-ins), and improve the shop. We do not sell your
        information.
      </p>

      <ContentHeading>Who processes it</ContentHeading>
      <p>
        Payments are handled by Safepay (they receive what they need to process
        the payment — never your password). Hosting and email delivery run on
        infrastructure providers engaged for this site. [placeholder — list the
        final provider set and countries once the owner signs off.]
      </p>

      <ContentHeading>How long we keep it</ContentHeading>
      <PlaceholderNote>
        [placeholder — retention periods for orders, accounts, and support
        correspondence must be decided and stated here.]
      </PlaceholderNote>

      <ContentHeading>Your choices</ContentHeading>
      <p>
        You can review and update your profile under Account → Profile, remove
        saved addresses under Account → Addresses, and ask us to delete your
        account or export your data using the Contact page. You can clear cookies
        through your browser at any time (you will be signed out).
      </p>

      <ContentHeading>Business details</ContentHeading>
      <PlaceholderNote>
        [placeholder — the legal entity name, address, and the contact point for
        privacy requests belong here.]
      </PlaceholderNote>
    </ContentPage>
  );
}
