import { getAdminVariations } from "@/modules/admin";
import { VariationRow } from "@/components/admin/VariationRow";

export default async function AdminVariationsPage() {
  const variations = await getAdminVariations();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-8">
        Variations & Inventory
      </h1>
      <div>
        {variations.map((v) => (
          <VariationRow key={v.id} variation={v} />
        ))}
      </div>
    </div>
  );
}