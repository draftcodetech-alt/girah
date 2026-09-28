import Link from "next/link";

type PaginationProps = {
  basePath: string;
  /** Current non-page query params to carry into every page link. */
  params: Partial<Record<string, string | undefined>>;
  page: number;
  totalPages: number;
};

function buildHref(basePath: string, params: PaginationProps["params"], page: number): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Filter changes reset to page 1 — carrying `page` across a narrower
    // result set is how you get empty pages.
    if (key === "page" || !value) continue;
    qs.set(key, value);
  }
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Numbers to render: everything up to 9 pages, else 1 … p-1 p p+1 … last. */
function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const nums = [...window].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

export function Pagination({ basePath, params, page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  const edgeClass =
    "flex items-center h-10 px-3 rounded-[var(--radius-control)] border border-border bg-cream font-body text-small text-muted select-none";
  const linkClass =
    "flex items-center justify-center min-w-10 h-10 px-2 rounded-[var(--radius-control)] border border-border bg-cream font-body text-small text-charcoal hover:border-sage transition-colors";
  const currentClass =
    "flex items-center justify-center min-w-10 h-10 px-2 rounded-[var(--radius-control)] border-2 border-sage bg-sage text-cream font-body text-small font-semibold";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 mt-12">
      {page > 1 ? (
        <Link href={buildHref(basePath, params, page - 1)} rel="prev" className={linkClass}>
          ← Prev
        </Link>
      ) : (
        <span className={edgeClass} aria-disabled="true">
          ← Prev
        </span>
      )}

      {pageNumbers(page, totalPages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-small text-muted" aria-hidden="true">
            …
          </span>
        ) : n === page ? (
          <span key={n} className={currentClass} aria-current="page">
            {n}
          </span>
        ) : (
          <Link key={n} href={buildHref(basePath, params, n)} className={linkClass}>
            {n}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={buildHref(basePath, params, page + 1)} rel="next" className={linkClass}>
          Next →
        </Link>
      ) : (
        <span className={edgeClass} aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}
