import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/modules/accounts";
import { ProfileForm } from "@/components/storefront/ProfileForm";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="acct-page">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Profile" }]}
      />
      <p className="ax-eyebrow">
        <span className="ax-eyebrow-line" aria-hidden="true" />
        YOUR DETAILS
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,2.8rem)] leading-[1.15] tracking-[0.02em] text-charcoal uppercase mb-8">
        Profile
      </h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
