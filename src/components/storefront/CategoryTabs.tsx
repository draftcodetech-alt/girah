import Link from "next/link";

type CategoryTabsProps = {
  categories: { name: string; slug: string }[];
  activeSlug?: string;
  sort?: string;
};

export function CategoryTabs({ categories, activeSlug, sort }: CategoryTabsProps) {
  const buildHref = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  };

  const tabClass = (isActive: boolean) =>
    `font-body text-body px-1 pb-1 border-b-2 transition-colors ${
      isActive
        ? "border-sage text-charcoal font-medium"
        : "border-transparent text-muted hover:text-charcoal"
    }`;

  return (
    <div className="flex gap-6 overflow-x-auto">
      <Link href={buildHref(undefined)} className={tabClass(!activeSlug)}>
        All
      </Link>
      {categories.map((cat) => (
        <Link key={cat.slug} href={buildHref(cat.slug)} className={tabClass(activeSlug === cat.slug)}>
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
