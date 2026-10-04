import type { CSSProperties } from "react";

// ── Line-art decorations (ported from the reference footer) ─────────────
// Drawn as plain components rather than <defs>+<use> so the footer owns
// no fragment ids (Hero already defines #lf on the homepage).

const LEAF_SPRIG_PLACEMENTS = [
  [28, 126, -72, 1.15],
  [50, 117, 18, 1.05],
  [72, 107, -62, 1],
  [96, 93, 14, 1.1],
  [116, 79, -66, 1.05],
  [138, 62, 8, 1],
  [152, 51, -70, 0.95],
  [176, 32, -48, 0.9],
  [192, 18, -58, 0.8],
] as const;

function LeafGlyph() {
  return (
    <>
      <path
        d="M0 0C6-12 26-16 44-8C34 6 14 10 0 0Z"
        fill="rgba(125,155,112,.2)"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2 0L38-7" stroke="currentColor" strokeWidth=".8" fill="none" />
      <path
        d="M12-3L18-10M20-4L27-11M12 1L19 6M21-3L29 4"
        stroke="currentColor"
        strokeWidth=".5"
        fill="none"
        opacity=".7"
      />
    </>
  );
}

export function Sprig({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" aria-hidden="true">
      <path
        d="M8 132C60 112 112 78 192 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill="none">
        {LEAF_SPRIG_PLACEMENTS.map(([x, y, rotate, scale]) => (
          <g
            key={`${x}-${y}`}
            transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
          >
            <LeafGlyph />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 29V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M16 18C8 18 5 12 5 6c7 0 11 4 11 12Z" fill="currentColor" opacity=".9" />
      <path d="M16 15C16 8 19 4 26 3c0 7-3 11-10 12Z" fill="currentColor" opacity=".9" />
    </svg>
  );
}

// Each yellow leaf carries its own gradient (unique id) — no shared defs.
export function YellowLeaf({
  gid,
  className,
  style,
}: {
  gid: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 70 34" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7cd6b" />
          <stop offset="1" stopColor="#e8a93a" />
        </linearGradient>
      </defs>
      <path d="M2 22C16 4 44 0 68 16C50 34 22 36 2 22Z" fill={`url(#${gid})`} />
      <path
        d="M2 22C24 20 46 18 68 16"
        stroke="#c98a22"
        strokeWidth="1"
        fill="none"
        opacity=".7"
      />
    </svg>
  );
}

export const YELLOW_LEAVES: { gid: string; style: CSSProperties }[] = [
  { gid: "ft-yg-1", style: { left: "9.3em", top: "4.3em", width: "3.7em", transform: "rotate(-12deg)" } },
  { gid: "ft-yg-2", style: { left: "28.2em", top: "25.2em", width: "3.2em", transform: "rotate(28deg)" } },
  { gid: "ft-yg-3", style: { left: "93.6em", top: "26.2em", width: "3.1em", transform: "rotate(-8deg)" } },
  { gid: "ft-yg-4", style: { left: "107.5em", top: "27.6em", width: "3.1em", transform: "rotate(-32deg)" } },
  { gid: "ft-yg-5", style: { left: "93em", top: "35em", width: "3.4em", transform: "rotate(22deg)" } },
  { gid: "ft-yg-6", style: { left: "10.2em", top: "35.6em", width: "3.4em", transform: "rotate(20deg)" } },
];
