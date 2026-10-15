import type { Metadata } from "next";
import { ContactSections } from "@/components/storefront/contact/ContactSections";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Girah, handmade crochet flowers made with love in Islamabad, Pakistan.",
};

export default function ContactPage() {
  return (
    <div className="py-8 pb-16">
      <ContactSections />
    </div>
  );
}
