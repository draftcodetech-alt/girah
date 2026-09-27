import { ResetPasswordForm } from "@/components/storefront/ResetPasswordForm";

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : undefined} />;
}
