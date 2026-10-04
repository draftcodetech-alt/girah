import Link from "next/link";
import Image from "next/image";

/**
 * About page — port of the single-file reference design (copy verbatim).
 * Sections: About / What We Make + How It Works (split per the "make and
 * how" mockup: text left, photo bleed right, category chips, rules) /
 * Our Story.
 * SVGs are inlined (no <symbol>/<use>) so CSS tokens reach every path — the
 * reference's descendant selectors could never pierce use's shadow tree.
 * Motion is CSS + scroll-driven (.ap-reveal pattern in globals.css): static
 * fallback where view() timelines are missing, killed under reduced motion.
 */

/* ── botanical sprig (inline; no ids at all) ── */
function Sprig() {
  return (
    <svg className="ap-sprig" viewBox="0 0 120 220" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M62 218C58 160 70 100 60 14" />
        <path d="M63 150C78 138 90 122 100 100" />
        <path d="M61 112C46 102 34 88 28 66" />
        <path d="M62 76C74 66 82 52 86 34" />
        {/* leaves */}
        <path className="ap-leaf" d="M63 190c-16-2-26-12-28-26 15 0 26 10 28 26z" />
        <path className="ap-leaf" d="M62 170c15-2 25-11 28-25-15 0-26 9-28 25z" />
        <path className="ap-leaf" d="M30 70c-12-4-18-13-18-24 12 3 18 12 18 24z" />
        <path className="ap-leaf" d="M86 38c10-5 14-14 12-24-10 4-14 12-12 24z" />
        {/* blossoms */}
        <g className="ap-blossom">
          <circle cx="60" cy="14" r="4.2" />
          <circle cx="52" cy="26" r="3.4" />
          <circle cx="70" cy="28" r="3.4" />
          <circle cx="100" cy="100" r="4" />
          <circle cx="92" cy="112" r="3" />
          <circle cx="108" cy="114" r="3" />
          <circle cx="28" cy="66" r="4" />
          <circle cx="20" cy="78" r="3" />
          <circle cx="38" cy="80" r="3" />
          <circle cx="86" cy="34" r="3.4" />
        </g>
      </g>
    </svg>
  );
}

/* ── mockup divider: line · sprig · line ── */
function SprigRule() {
  return (
    <div className="ap-rule ap-reveal" aria-hidden="true">
      <svg viewBox="0 0 260 32">
        <path className="ap-rule-line" d="M0 16h100" />
        <path className="ap-rule-line" d="M160 16h100" />
        <path className="ap-rule-stem" d="M130 16V7" />
        <path className="ap-rule-leaf" d="M130 13.5c-4.2 0-6.8-2.7-6.8-6.6 4.2 0 6.8 2.7 6.8 6.6z" />
        <path className="ap-rule-leaf" d="M130 13.5c4.2 0 6.8-2.7 6.8-6.6-4.2 0-6.8 2.7-6.8 6.6z" />
        <path className="ap-rule-leaf" d="M130 9c-3 0-4.9-2-4.9-4.9 3 0 4.9 2 4.9 4.9z" />
        <path className="ap-rule-leaf" d="M130 9c3 0 4.9-2 4.9-4.9-3 0-4.9 2-4.9 4.9z" />
        <circle className="ap-rule-bud" cx="130" cy="6.4" r="2.2" />
      </svg>
    </div>
  );
}

/* ── mockup's WHAT WE MAKE category chips (line icons) ── */
const CATEGORIES: { label: string; shapes: string[] }[] = [
  {
    label: "Wearables",
    shapes: ["M12 8V6.8a2 2 0 1 1 2 2", "M12 8 3.8 14.9A1.5 1.5 0 0 0 4.7 18h14.6a1.5 1.5 0 0 0 .9-3.1L12 8z"],
  },
  { label: "Home Decor", shapes: ["M4 11.5 12 5l8 6.5", "M6.5 10.3V19h11v-8.7", "M10 19v-4.4h4V19"] },
  { label: "Accessories", shapes: ["M6.5 8.5h11l-1 10.5h-9L6.5 8.5z", "M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5"] },
  {
    label: "Gifts",
    shapes: [
      "M5 10h14v8.5H5z",
      "M3.8 7h16.4v3H3.8z",
      "M12 7v11.5",
      "M12 7s-1.4-2.5-3.2-2.5a2 2 0 0 0 0 4.2",
      "M12 7s1.4-2.5 3.2-2.5a2 2 0 0 1 0 4.2",
    ],
  },
];

/* ── knot divider (thread draws in, kraft knot fades after) ── */
function KnotDivider({ last = false }: { last?: boolean }) {
  return (
    <div className={last ? "ap-divider ap-divider-last ap-reveal" : "ap-divider ap-reveal"} aria-hidden="true">
      <svg viewBox="0 0 300 40">
        <path className="ap-thread" pathLength={1} d="M0 20C25 4 50 36 78 20S120 8 132 20" />
        <ellipse className="ap-knot" cx="150" cy="20" rx="14" ry="7" transform="rotate(28 150 20)" />
        <ellipse className="ap-knot" cx="150" cy="20" rx="14" ry="7" transform="rotate(-28 150 20)" />
        <path className="ap-thread" pathLength={1} d="M168 20C180 8 200 36 222 20S275 4 300 20" />
      </svg>
    </div>
  );
}

export function AboutSections() {
  return (
    <div className="about-page">
      {/* ============ 1. ABOUT GIRAH (image left) ============ */}
      <section className="ap-about" id="about">
        <div className="ap-sprig-slot ap-s1">
          <Sprig />
        </div>

        <div className="ap-media ap-reveal">
          <Image
            className="ap-blob-img"
            src="/about/sunflower.webp"
            width={1362}
            height={1155}
            priority
            alt="A handmade crochet sunflower bouquet wrapped in kraft paper with a Handmade with love tag"
          />
          <span className="ap-note ap-note-bl ap-wipe">knot by knot</span>
        </div>

        <div className="ap-copy ap-reveal ap-reveal-late">
          <p className="ap-eyebrow">About Girah</p>
          <h1>About</h1>
          <p className="ap-lede">
            There is quiet magic in the making — a strand of yarn, a loop, then another, until something exists that did
            not exist before. Girah means knot, and everything we make begins with one. Handmade in Pakistan, minimal in
            form, made to be held, gifted, and kept for years.
          </p>
        </div>
      </section>

      <KnotDivider />

      {/* ============ 2. WHAT WE MAKE + HOW IT WORKS (split, photo right — mockup) ============ */}
      <section className="ap-make" id="make">
        <div className="ap-make-split">
          <div className="ap-make-copy ap-reveal ap-reveal-late">
            <p className="ap-eyebrow">What We Make</p>
            <h2 className="ap-make-title">
              Quiet, but <em>never forgettable.</em>
            </h2>
            <p>
              Wearables, home decor, accessories, and gifts — clean lines, soft silhouettes, and one detail that makes
              you look twice.
            </p>
            <p>
              Ready-to-ship pieces leave us quickly; everything else is made to order in the colors you choose. Custom
              pieces: write to us, and we will bring it to life, knot by knot.
            </p>

            <SprigRule />

            <ul className="ap-chips">
              {CATEGORIES.map((c) => (
                <li className="ap-chip" key={c.label}>
                  <span className="ap-chip-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      {c.shapes.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                  <span className="ap-chip-label">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ap-make-media ap-reveal">
            <Image
              fill
              sizes="(max-width: 860px) 100vw, 46vw"
              className="ap-make-img"
              src="/about/make-how.webp"
              alt="A cream table with a glass vase of crochet daisies, stacked books, scissors and a basket of green yarn"
            />
            <div className="ap-make-fade" aria-hidden="true" />
          </div>
        </div>

        <div className="ap-how">
          <h3 className="ap-reveal">How It Works</h3>
          <ol className="ap-steps ap-reveal">
            <li>
              <strong>First, you choose or you dream.</strong>
              <Link href="/shop" className="ap-link">
                Browse the collection
              </Link>{" "}
              or send us a request. No wrong answers here.
            </li>
            <li>
              <strong>Second, we listen.</strong>Colors, size, yarn, timeline — confirmed until it feels exactly
              right.
            </li>
            <li>
              <strong>Third, we make.</strong>By hand, three to ten days for made to order pieces. Good things are not
              rushed.
            </li>
            <li>
              <strong>Fourth, we wrap.</strong>Soft, eco-friendly packaging — ready to keep or give.
            </li>
            <li>
              <strong>Fifth, it reaches you.</strong>We ship across Islamabad and Lahore with tracking.
            </li>
          </ol>
        </div>
      </section>

      <KnotDivider />

      {/* ============ 3. OUR STORY (image left) ============ */}
      <section className="ap-about" id="story">
        <div className="ap-sprig-slot ap-s3">
          <Sprig />
        </div>
        <div className="ap-sprig-slot ap-s2">
          <Sprig />
        </div>

        <div className="ap-media ap-reveal">
          <Image
            className="ap-blob-img"
            src="/about/sunflower.webp"
            width={1362}
            height={1155}
            alt="Crochet sunflowers and daisies in kraft paper wrapping, tied with twine"
          />
        </div>

        <div className="ap-copy ap-story ap-reveal ap-reveal-late">
          <h2 className="ap-section-title">Our Story</h2>

          <p>Girah began quietly, with a single knot and a love for crochet — its rhythm, its patience.</p>
          <p>
            A private joy grew into a studio, then a team of makers who share one belief: handmade things carry
            something machines never can.
          </p>
          <p>
            The name Girah means knot. One knot, then another, until a line of yarn becomes a flower, a bag, a gift
            someone holds onto for years.
          </p>

          <blockquote className="ap-pull">
            A knot is small and easy to overlook, but it is the knot that holds everything together.
          </blockquote>

          <p>
            Today we make minimalist pieces for people who value slow craft over fast production — meant to last in
            style, quality, and meaning.
          </p>

          <div className="ap-closing">
            <p className="ap-big">And every knot carries a story. This one is ours.</p>
            <span className="ap-sign">The next one is yours.</span>
          </div>
        </div>
      </section>

      <KnotDivider last />
    </div>
  );
}
