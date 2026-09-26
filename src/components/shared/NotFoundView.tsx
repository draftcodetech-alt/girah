import Link from "next/link";

export function NotFoundView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage">Error 404</p>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mt-3">Page not found</h1>
      <p className="font-body text-body text-muted mt-4 max-w-[440px]">
        The page you are looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        <Link
          href="/"
          className="h-12 px-6 leading-[48px] rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
        >
          Go Home
        </Link>
        <Link
          href="/shop"
          className="h-12 px-6 leading-[48px] rounded-[var(--radius-control)] border border-border text-charcoal font-body text-button font-semibold hover:border-sage"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
