export function RouteSkeleton({ contained = true }: { contained?: boolean }) {
  const bars = (
    <>
      <div className="h-9 w-64 rounded-[var(--radius-control)] bg-sage-light" />
      <div className="h-24 rounded-[var(--radius-surface)] bg-sage-light" />
      <div className="h-24 rounded-[var(--radius-surface)] bg-sage-light" />
      <div className="h-24 rounded-[var(--radius-surface)] bg-sage-light" />
    </>
  );

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse space-y-4 ${
        contained ? "max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-12 w-full" : ""
      }`}
    >
      {bars}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
