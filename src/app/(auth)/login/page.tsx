import { LoginForm } from "@/components/storefront/LoginForm";

type SearchParams = Promise<{ callbackUrl?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />;
}
