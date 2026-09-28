import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * Home hero — 1:1 port of the approved mockup (palette, grid, doodles,
 * falling leaves, settle/drift motion live in globals.css under `.hero`,
 * with the palette scoped to the section). Integration deltas only:
 *   - CTA is ButtonLink → /shop with the locked "Shop Handmade" label
 *   - h1 id="home-hero" (aria-labelledby on the section)
 *   - bouquet via next/image (priority LCP)
 * All decorative SVGs are aria-hidden; the single ButtonLink is the only
 * interactive element (locked by tests).
 */
export function Hero() {
  return (
    <section className="hero min-h-[80vh]" aria-labelledby="home-hero">
      {/* Shared SVG defs: leaf shape, gradients, yellow-leaf symbol, filters.
          Must stay rendered (not display:none) so url(#…) references resolve. */}
      <svg className="svg-defs" aria-hidden="true" focusable="false">
        <defs>
          {/* Drawn leaf: base at (0,0), tip at (100,0). Fill/stroke inherited from <use> parent. */}
          <g id="lf">
            <path
              d="M0 0 C 12 -21, 60 -25, 100 0 C 60 23, 14 21, 0 0 Z"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M0 0 Q 50 -3 97 0" fill="none" vectorEffect="non-scaling-stroke" />
            <path
              d="M20 -1 L 38 -14 M20 0 L 36 12 M42 -2 L 60 -14 M42 0 L 58 11 M64 -2 L 80 -9 M64 0 L 78 8 M30 -4 L 33 -6 M50 5 L 54 8"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </g>

          <linearGradient id="ygrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#EDC24A" />
            <stop offset="1" stopColor="#C79A24" />
          </linearGradient>

          {/* Yellow falling leaf (matches leaf.png reference) */}
          <symbol id="ylf" viewBox="0 0 100 50">
            <path
              d="M1 12 C 8 13 16 10 26 8 C 52 1 84 12 98 35 C 78 46 48 48 30 39 C 18 33 12 20 1 12 Z"
              fill="url(#ygrad)"
            />
            <path
              d="M12 14 C 40 15 70 22 97 34"
              fill="none"
              stroke="#B8891B"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M28 17 L 34 30 M42 18 L 50 33 M56 22 L 66 36 M70 27 L 80 39 M30 15 L 38 8 M46 17 L 58 10 M62 22 L 76 17"
              fill="none"
              stroke="#B8891B"
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity="0.7"
            />
          </symbol>

          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 .42  0 0 0 0 .34  0 0 0 0 .2  0 0 0 .9 0"
            />
          </filter>
        </defs>
      </svg>

      {/* paper grain texture */}
      <svg
        className="hero__grain"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
      >
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* soft blurred leaf shadows (top left) */}
      <svg
        className="hero__shadow"
        viewBox="0 0 800 520"
        preserveAspectRatio="xMinYMin slice"
        aria-hidden="true"
        focusable="false"
      >
        <g filter="url(#soft)" fill="#2E4A37" stroke="none">
          <path d="M-40 60 C 120 110 260 200 420 360" fill="none" stroke="#2E4A37" strokeWidth="7" />
          <use href="#lf" transform="translate(60 88) rotate(30) scale(2.4)" />
          <use href="#lf" transform="translate(150 132) rotate(-15) scale(2.2)" />
          <use href="#lf" transform="translate(200 170) rotate(64) scale(2.6)" />
          <use href="#lf" transform="translate(290 250) rotate(20) scale(2.5)" />
          <use href="#lf" transform="translate(330 290) rotate(78) scale(2.3)" />
          <use href="#lf" transform="translate(400 350) rotate(38) scale(2.7)" />
          <path d="M180 -30 C 260 40 300 110 380 170" fill="none" stroke="#2E4A37" strokeWidth="6" />
          <use href="#lf" transform="translate(240 20) rotate(60) scale(2.2)" />
          <use href="#lf" transform="translate(300 90) rotate(20) scale(2.4)" />
          <use href="#lf" transform="translate(340 130) rotate(72) scale(2)" />
        </g>
      </svg>

      {/* top right sprig doodle */}
      <svg
        className="sprig sprig--right"
        viewBox="0 0 300 420"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M290 -4 C 268 62 240 118 208 176 C 186 218 178 262 178 300"
          fill="none"
          stroke="#46552F"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <g fill="#ECEADB" stroke="#46552F" strokeWidth="1.4">
          <use href="#lf" transform="translate(272 48) rotate(152) scale(.82)" />
          <use href="#lf" transform="translate(282 38) rotate(102) scale(.7)" />
          <use href="#lf" transform="translate(248 98) rotate(166) scale(.72)" />
          <use href="#lf" transform="translate(238 122) rotate(58) scale(.5)" />
          <use href="#lf" transform="translate(228 142) rotate(172) scale(1.05)" />
          <use href="#lf" transform="translate(212 168) rotate(112) scale(.5)" />
          <use href="#lf" transform="translate(200 206) rotate(46) scale(.95)" />
          <use href="#lf" transform="translate(180 250) rotate(88) scale(1.5)" />
        </g>
      </svg>

      {/* bottom left sprig doodle */}
      <svg
        className="sprig sprig--left"
        viewBox="0 0 330 440"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="#46552F" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 432 C 62 340 112 262 148 178 C 158 150 162 118 160 88" />
          <path d="M58 344 C 110 318 170 306 222 304" />
          <path d="M40 384 C 96 356 148 372 196 398" />
        </g>
        <g fill="#ECEADB" stroke="#46552F" strokeWidth="1.4">
          <use href="#lf" transform="translate(148 178) rotate(-75) scale(1.45)" />
          <use href="#lf" transform="translate(160 92) rotate(-60) scale(.6)" />
          <use href="#lf" transform="translate(128 222) rotate(-160) scale(1.05)" />
          <use href="#lf" transform="translate(150 190) rotate(-20) scale(1.1)" />
          <use href="#lf" transform="translate(118 244) rotate(-36) scale(.55)" />
          <use href="#lf" transform="translate(86 300) rotate(155) scale(.6)" />
          <use href="#lf" transform="translate(66 336) rotate(-50) scale(.9)" />
          <use href="#lf" transform="translate(222 304) rotate(-5) scale(.95)" />
          <use href="#lf" transform="translate(170 312) rotate(-60) scale(.55)" />
          <use href="#lf" transform="translate(196 308) rotate(55) scale(.5)" />
          <use href="#lf" transform="translate(136 326) rotate(-45) scale(.45)" />
          <use href="#lf" transform="translate(196 398) rotate(20) scale(1)" />
          <use href="#lf" transform="translate(150 372) rotate(60) scale(.6)" />
          <use href="#lf" transform="translate(110 364) rotate(-50) scale(.55)" />
        </g>
      </svg>

      {/* ---------- Copy ---------- */}
      <div className="hero__copy">
        <p className="eyebrow">
          <span className="eyebrow__rule" />
          <svg
            className="eyebrow__icon"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 28 C 16 20 16 14 16 8" />
            <path d="M16 20 C 8 20 4 14 4 8 C 11 8 15 12 16 20 Z" />
            <path d="M16 15 C 21 15 26 11 27 5 C 21 5 17 9 16 15 Z" />
          </svg>
          <span>HANDMADE WITH LOVE</span>
          <span className="eyebrow__rule" />
        </p>

        <h1 className="hero__title" id="home-hero">
          <span>Handmade Pieces,</span>
          <span>Made to Be Cherished.</span>
        </h1>

        <p className="hero__lead">From lasting blooms to little keepsakes, every piece is made with care.</p>

        <ButtonLink href="/shop" className="btn rounded-full">
          Shop Handmade
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12h16M14 6l6 6-6 6" />
          </svg>
        </ButtonLink>
      </div>

      {/* ---------- Imagery ---------- */}
      <div className="hero__stage">
        {/* sage green backdrop shape */}
        <svg
          className="hero__blob"
          viewBox="0 0 1000 520"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="sageGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#93A282" />
              <stop offset="1" stopColor="#84937A" />
            </linearGradient>
          </defs>
          <path
            d="M0 520 C 150 400 340 350 560 330 C 760 312 900 260 1000 190 L1000 520 Z"
            fill="url(#sageGrad)"
          />
          <path
            d="M560 520 C 700 470 860 430 1000 400 L1000 520 Z"
            fill="#7F8E73"
            opacity="0.45"
          />
        </svg>

        <Image
          src="/florals/bouquet-hero.png"
          alt="Handmade crochet sunflower bouquet wrapped in kraft paper with a Girah tag"
          width={1291}
          height={1218}
          priority
          className="hero__bouquet"
        />

        {/* falling leaves (inline SVG, drawn from leaf.png reference) */}
        <svg className="fall fall--a" viewBox="0 0 100 50" aria-hidden="true" focusable="false">
          <use href="#ylf" />
        </svg>
        <svg className="fall fall--b" viewBox="0 0 100 50" aria-hidden="true" focusable="false">
          <use href="#ylf" />
        </svg>
        <svg className="fall fall--c" viewBox="0 0 100 50" aria-hidden="true" focusable="false">
          <use href="#ylf" />
        </svg>
      </div>
    </section>
  );
}
