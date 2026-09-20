import { notFound } from "next/navigation";
import { getProductBySlug } from "@/modules/catalog";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { PurchasePanel } from "@/components/storefront/PurchasePanel";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="lg:w-[60%]">
          <ProductGallery images={product.images} alt={product.name} />
        </div>
        <div className="lg:w-[40%]">
          <PurchasePanel product={product} />
        </div>
      </div>
    </div>
  );
}
