import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/modules/accounts";
import { ProfileForm } from "@/components/storefront/ProfileForm";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Profile" }]}
      />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">Profile</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
