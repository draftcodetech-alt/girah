/**
 * Brand placeholder for merchandise with no photos uploaded yet (the shop
 * keeps these products listed, per the owner's pending photo set). A soft
 * stage with the house botanical motif and an honest caption — replaces the
 * bare "No image" text. Decorative only; the caption carries the meaning.
 */
export function ImageFallback({ className }: { className?: string }) {
  return (
    <span className={`ax-imgfallback ${className ?? ""}`}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* leaf stem — echoes the footer botanicals */}
        <path d="M60 102c-2-26 6-46 24-64" opacity="0.8" />
        <path d="M74 66c-14-3-22-11-25-24 13 0 22 9 25 24Z" />
        <path d="M70 44c-12-5-17-14-16-26 11 5 16 14 16 26Z" />
        <path d="M82 52c1-13 7-21 18-26 2 12-5 22-18 26Z" />
        {/* five-petal bloom */}
        <circle cx="44" cy="42" r="7" />
        <path d="M44 35c-4-6-2-12 3-15 5 3 7 9 3 15" />
        <path d="M37 40c-7-1-11-5-12-12 7-1 12 3 12 12" />
        <path d="M37 46c-6 3-12 2-16-3 5-5 11-4 16 3" />
        <path d="M40 50c-2 7-7 10-14 10 1-7 7-11 14-10" />
        <path d="M50 49c4 6 3 12-2 16-5-4-6-10-2-16" />
      </svg>
      <span className="ax-imgfallback-caption">Photo coming soon</span>
    </span>
  );
}
