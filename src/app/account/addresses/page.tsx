import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyShippingAddress } from "@/modules/addresses";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { AddressForm } from "@/components/storefront/AddressForm";

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Faccount%2Faddresses");
  }

  const address = await getMyShippingAddress();

  return (
    <div className="max-w-[700px] mx-auto px-4 py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Shipping Address" },
        ]}
      />
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal">
        Shipping Address
      </h1>
      <p className="font-body text-body text-muted mt-2">
        Your default delivery address — checkout fills it in automatically.
      </p>

      <AddressForm key={address?.address ?? "none"} address={address} />
    </div>
  );
}
