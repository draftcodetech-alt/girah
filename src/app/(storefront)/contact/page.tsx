import type { Metadata } from "next";
import { ContentPage, ContentHeading, PlaceholderNote } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach Girah — the channels below are live when configured.",
};

function contactChannels() {
  const channels: { label: string; href: string }[] = [];
  if (process.env.NEXT_PUBLIC_CONTACT_EMAIL) {
    channels.push({ label: process.env.NEXT_PUBLIC_CONTACT_EMAIL, href: `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}` });
  }
  if (process.env.NEXT_PUBLIC_WHATSAPP_URL) {
    channels.push({ label: "WhatsApp", href: process.env.NEXT_PUBLIC_WHATSAPP_URL });
  }
  if (process.env.NEXT_PUBLIC_INSTAGRAM_URL) {
    channels.push({ label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL });
  }
  return channels;
}

export default function ContactPage() {
  const channels = contactChannels();

  return (
    <ContentPage title="Contact">
      <p>
        Questions about an order, a custom piece, or anything else — reach out on
        any channel below.
      </p>

      <ContentHeading>Direct channels</ContentHeading>
      {channels.length > 0 ? (
        <ul className="space-y-2">
          {channels.map((channel) => (
            <li key={channel.label}>
              <a
                href={channel.href}
                className="underline text-sage hover:text-charcoal"
                {...(channel.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {channel.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <PlaceholderNote>
          [placeholder — contact channels are shown here once
          NEXT_PUBLIC_CONTACT_EMAIL / NEXT_PUBLIC_WHATSAPP_URL /
          NEXT_PUBLIC_INSTAGRAM_URL are configured.]
        </PlaceholderNote>
      )}

      <ContentHeading>Order issues</ContentHeading>
      <p>
        For anything order-related, include your order number (it is in your
        confirmation page and in your account under Orders) — that is all we need
        to find you quickly.
      </p>

      <ContentHeading>Studio</ContentHeading>
      <PlaceholderNote>
        [placeholder — postal address, phone number, and response hours belong
        here once decided.]
      </PlaceholderNote>
    </ContentPage>
  );
}
