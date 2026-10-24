import type { Metadata } from "next";
import { ExecutiveLoginForm } from "@/components/storefront/ExecutiveLoginForm";

// Owner spec (single-owner store): the admin door is typed by hand — never
// indexed, never linked, never in the sitemap.
export const metadata: Metadata = {
  title: "Executive Login",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ callbackUrl?: string | string[] }>;

export default async function ExecutiveLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { callbackUrl } = await searchParams;
  return <ExecutiveLoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />;
}
