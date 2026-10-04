import type { Metadata } from "next";
import { AboutSections } from "@/components/storefront/about/AboutSections";

export const metadata: Metadata = {
  title: "About",
  description: "Girah — handmade crochet bouquets and keychains, crocheted by hand in small batches.",
};

export default function AboutPage() {
  return <AboutSections />;
}
