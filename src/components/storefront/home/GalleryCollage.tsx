"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Home gallery collage — 1:1 port of the approved girah-gallery reference
 * ("A little world, made by hand"). Palette + motion live in globals.css
 * under `.girah-gallery` / `.gg-*` (scoped, like `.hero`). Behaviour ports
 * the reference's vanilla script: staggered IntersectionObserver reveal,
 * hover tilt, mouse + scroll parallax, drifting leaves — all gated on
 * reduced-motion; drift leaves are created client-side only (no hydration
 * mismatch). CTA points at /shop (integration delta from #products).
 */

type Caption = {
  text: string;
  pos: "t" | "tr" | "b" | "r" | "l";
  ct?: string;
  maxWidth?: string;
};

type CollageItem = {
  src: string;
  width: number;
  height: number;
  alt: string;
  x: string;
  y: string;
  w: string;
  r: string;
  depth: string;
  fade: string;
  d: string;
  fl: string;
  fd: string;
  blob: string;
  circle?: boolean;
  cap?: Caption;
};

const SAGE = "var(--gg-sage)";
const BUTTER = "var(--gg-butter)";
const BLUSH = "var(--gg-blush)";
const SAND = "var(--gg-sand)";

const ITEMS: CollageItem[] = [
  {
    src: "/gallery/sunflower.webp",
    width: 940,
    height: 940,
    alt: "Crocheted sunflower bouquet wrapped in kraft paper",
    x: "2.604",
    y: "25.41",
    w: "29.297",
    r: "-2deg",
    depth: "1.0",
    fade: "11%",
    d: "0.00s",
    fl: "7.5s",
    fd: "0.0s",
    blob: SAGE,
    cap: { text: "Keep a bloom close", pos: "b" },
  },
  {
    src: "/gallery/duck.webp",
    width: 410,
    height: 660,
    alt: "Crocheted duck keychain with a leaf charm",
    x: "33.854",
    y: "4.918",
    w: "11.068",
    r: "3deg",
    depth: "1.5",
    fade: "9%",
    d: "0.11s",
    fl: "6.2s",
    fd: "5.7s",
    blob: BUTTER,
    cap: { text: "Little keepsakes, made to last", pos: "r", maxWidth: "7em" },
  },
  {
    src: "/gallery/rabbit.webp",
    width: 147,
    height: 255,
    alt: "Crocheted bunny with a green bow",
    x: "38.411",
    y: "30.328",
    w: "9.115",
    r: "-3deg",
    depth: "1.3",
    fade: "12%",
    d: "0.22s",
    fl: "6.8s",
    fd: "4.4s",
    blob: BLUSH,
  },
  {
    src: "/gallery/wallhanging.webp",
    width: 520,
    height: 1180,
    alt: "Crocheted daisy and leaf wall hanging with tassels",
    x: "55.664",
    y: "2.459",
    w: "11.068",
    r: "1deg",
    depth: "0.9",
    fade: "7%",
    d: "0.33s",
    fl: "8.2s",
    fd: "3.1s",
    blob: SAND,
    cap: { text: "Crafted with care", pos: "b" },
  },
  {
    src: "/gallery/lily.webp",
    width: 650,
    height: 830,
    alt: "Crocheted lily bouquet with a Girah tag",
    x: "67.708",
    y: "7.787",
    w: "20.508",
    r: "2deg",
    depth: "1.1",
    fade: "9%",
    d: "0.44s",
    fl: "7.1s",
    fd: "1.8s",
    blob: SAGE,
    cap: { text: "Flowers that never fade", pos: "t" },
  },
  {
    src: "/gallery/purse.webp",
    width: 720,
    height: 1050,
    alt: "Green crocheted tote with daisy appliques",
    x: "89.062",
    y: "9.836",
    w: "10.417",
    r: "3deg",
    depth: "1.4",
    fade: "9%",
    d: "0.55s",
    fl: "6.5s",
    fd: "0.5s",
    blob: BUTTER,
    cap: { text: "Carry a little joy", pos: "t" },
  },
  {
    src: "/gallery/sheep.webp",
    width: 165,
    height: 155,
    alt: "Crocheted lamb toy",
    x: "89.193",
    y: "33.607",
    w: "9.44",
    r: "-2deg",
    depth: "1.6",
    fade: "12%",
    d: "0.00s",
    fl: "5.8s",
    fd: "6.2s",
    blob: SAND,
    cap: { text: "Tiny, woolly joys", pos: "b" },
  },
  {
    src: "/gallery/tulips.webp",
    width: 476,
    height: 469,
    alt: "Basket of crocheted tulips and lilies",
    x: "65.755",
    y: "40.984",
    w: "19.531",
    r: "-2deg",
    depth: "0.8",
    fade: "10%",
    d: "0.11s",
    fl: "7.8s",
    fd: "4.9s",
    blob: BLUSH,
    cap: { text: "Blooms in every shade", pos: "l", ct: "12%" },
  },
  {
    src: "/gallery/bracelet.webp",
    width: 205,
    height: 150,
    alt: "Crocheted flower bracelet",
    x: "86.589",
    y: "51.23",
    w: "12.044",
    r: "4deg",
    depth: "1.5",
    fade: "12%",
    d: "0.22s",
    fl: "6.0s",
    fd: "3.6s",
    blob: SAGE,
  },
  {
    src: "/gallery/plant.webp",
    width: 730,
    height: 970,
    alt: "Crocheted potted leaf plant in a cream pot",
    x: "44.271",
    y: "54.098",
    w: "16.276",
    r: "0deg",
    depth: "1.0",
    fade: "10%",
    d: "0.33s",
    fl: "8.0s",
    fd: "2.3s",
    blob: SAGE,
    cap: { text: "Green, forever thriving", pos: "t" },
  },
  {
    src: "/gallery/coasters.webp",
    width: 260,
    height: 262,
    alt: "Stack of crocheted flower coasters",
    x: "26.042",
    y: "64.754",
    w: "16.602",
    r: "-4deg",
    depth: "1.2",
    fade: "10%",
    d: "0.44s",
    fl: "7.0s",
    fd: "1.0s",
    blob: BUTTER,
    cap: { text: "Small pieces, big happiness", pos: "b" },
  },
  {
    src: "/gallery/yarn.webp",
    width: 1120,
    height: 910,
    alt: "Balls of cotton yarn with two bamboo crochet hooks",
    x: "1.953",
    y: "70.492",
    w: "22.135",
    r: "2deg",
    depth: "0.9",
    fade: "10%",
    d: "0.55s",
    fl: "7.4s",
    fd: "6.7s",
    blob: SAND,
    cap: { text: "From yarn, something special", pos: "b" },
  },
  {
    src: "/gallery/macro.webp",
    width: 206,
    height: 206,
    alt: "Close up of crochet flower stitches",
    x: "61.198",
    y: "75.0",
    w: "12.044",
    r: "0deg",
    depth: "1.3",
    fade: "0%",
    d: "0.00s",
    fl: "6.4s",
    fd: "5.4s",
    blob: BUTTER,
    circle: true,
    cap: { text: "Beauty in every stitch", pos: "t" },
  },
  {
    src: "/gallery/purse-vines.webp",
    width: 700,
    height: 720,
    alt: "Crocheted handbag with daisies, leaves and a Girah tag",
    x: "76.823",
    y: "66.393",
    w: "19.531",
    r: "-2deg",
    depth: "0.9",
    fade: "9%",
    d: "0.11s",
    fl: "7.6s",
    fd: "4.1s",
    blob: SAGE,
    cap: { text: "Tiny details, big joys", pos: "b" },
  },
];

function CaptionArrow() {
  return (
    <svg className="gg-arrow" viewBox="0 0 64 40" aria-hidden="true">
      <path pathLength="1" d="M6 5 C 14 34 42 36 56 13" />
      <path pathLength="1" d="M56 13 L47 16 M56 13 L55.5 23" />
    </svg>
  );
}

export function GalleryCollage() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector<HTMLElement>(".gg-stage");
    const drift = root.querySelector<HTMLElement>(".gg-drift");
    if (!stage) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>(".gg-item"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const cleanups: Array<() => void> = [];

    // 1. staggered reveal: each piece floats in as it enters the viewport
    if ("IntersectionObserver" in window && !reduce) {
      const ioItems = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("gg-show");
              ioItems.unobserve(e.target);
            }
          }
        },
        { threshold: 0.12 }
      );
      items.forEach((it) => ioItems.observe(it));

      // heading, stitches, vine, sprigs and threads start when the stage is on screen
      const ioStage = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            root.classList.add("gg-in");
            ioStage.disconnect();
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0 }
      );
      ioStage.observe(stage);

      // pause the endless animations when the section is off screen
      const ioPause = new IntersectionObserver((entries) => {
        root.classList.toggle("gg-paused", !entries[0]?.isIntersecting);
      });
      ioPause.observe(root);

      cleanups.push(() => {
        ioItems.disconnect();
        ioStage.disconnect();
        ioPause.disconnect();
      });
    } else {
      items.forEach((it) => it.classList.add("gg-show"));
      root.classList.add("gg-in");
    }

    // 2. hover tilt + gentle mouse parallax (fine pointer, motion allowed)
    if (fine && !reduce) {
      for (const it of items) {
        const tilt = it.querySelector<HTMLElement>(".gg-tilt");
        if (!tilt) continue;
        const onMove = (e: PointerEvent) => {
          const r = it.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          tilt.style.transform =
            "perspective(720px) rotateX(" +
            (-py * 14).toFixed(2) +
            "deg) rotateY(" +
            (px * 16).toFixed(2) +
            "deg) scale(1.07)";
        };
        const onLeave = () => {
          tilt.style.transform = "";
        };
        it.addEventListener("pointermove", onMove);
        it.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          it.removeEventListener("pointermove", onMove);
          it.removeEventListener("pointerleave", onLeave);
        });
      }

      // closer pieces (higher --depth) move more
      let raf = 0;
      let tx = 0;
      let ty = 0;
      const onPointerMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            stage.style.setProperty("--mx", (-tx * 16).toFixed(1));
            stage.style.setProperty("--my", (-ty * 12).toFixed(1));
          });
        }
      };
      const onPointerLeave = () => {
        stage.style.setProperty("--mx", "0");
        stage.style.setProperty("--my", "0");
      };
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerleave", onPointerLeave);
      cleanups.push(() => {
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerleave", onPointerLeave);
        if (raf) cancelAnimationFrame(raf);
      });
    }

    // 3. scroll parallax: --sp goes 0 > 1 while the section crosses the viewport
    if (!reduce) {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const r = root.getBoundingClientRect();
          const vh = window.innerHeight;
          const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
          stage.style.setProperty("--sp", p.toFixed(3));
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    // 4. drifting leaves and petals (client-only: Math.random + innerHTML)
    if (!reduce && drift) {
      const colors = ["#7d9462", "#8fa56f", "#6b8553", "#9aae78", "#e0b54a", "#efc76a", "#e7a99f"];
      const setH = () => {
        root.style.setProperty("--H", root.offsetHeight + "px");
      };
      setH();
      window.addEventListener("resize", setH);
      const n = window.innerWidth < 860 ? 9 : 16;
      for (let i = 0; i < n; i++) {
        const petal = i % 4 === 3;
        const s = document.createElement("span");
        s.className = "gg-fall";
        const c = petal ? (i % 8 === 3 ? "#e7a99f" : "#efc76a") : colors[i % 4];
        s.style.cssText =
          "--l:" +
          (Math.random() * 96).toFixed(1) +
          "%;--s:" +
          (petal ? 9 + Math.random() * 7 : 12 + Math.random() * 14).toFixed(1) +
          "px;--dur:" +
          (16 + Math.random() * 14).toFixed(1) +
          "s;--del:" +
          (-Math.random() * 28).toFixed(1) +
          "s;--sw:" +
          (2.6 + Math.random() * 3).toFixed(1) +
          "s;--dx:" +
          (-90 + Math.random() * 180).toFixed(0) +
          "px;--c:" +
          c;
        s.innerHTML =
          '<svg viewBox="0 0 40 60"><use href="#' + (petal ? "gg-petal" : "gg-leaf") + '"/></svg>';
        drift.appendChild(s);
      }
      cleanups.push(() => {
        window.removeEventListener("resize", setH);
        drift.innerHTML = "";
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return (
    <section ref={rootRef} className="girah-gallery" id="gallery" aria-labelledby="gg-heading">
      {/* hidden vector symbols used by the section (drift leaves + sprigs) */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <symbol id="gg-leaf" viewBox="0 0 40 60">
            <path d="M20 2C34 14 37 40 20 58 3 40 6 14 20 2Z" fill="currentColor" />
            <path
              d="M20 9V52"
              stroke="rgba(255,255,255,.38)"
              strokeWidth="1.3"
              fill="none"
            />
          </symbol>
          <symbol id="gg-petal" viewBox="0 0 40 60">
            <path d="M20 3C34 16 34 42 20 57 6 42 6 16 20 3Z" fill="currentColor" />
          </symbol>
          <symbol id="gg-sprig" viewBox="0 0 200 260">
            <path
              pathLength="1"
              d="M24.0 245.0 L25.8 233.8 L27.7 222.5 L29.9 211.2 L32.3 200.0 L35.1 188.8 L38.3 177.5 L42.1 166.2 L46.4 155.0 L51.4 143.8 L57.1 132.5 L63.4 121.2 L70.4 110.0 L78.0 98.8 L86.3 87.5 L95.2 76.2 L104.5 65.0 L114.4 53.8 L124.6 42.5 L135.1 31.2 L145.8 20.0"
            />
            <path
              pathLength="1"
              d="M29.4 213.5 C45.9 218.3 63.2 208.3 69.7 195.8 C56.1 192.2 37.1 198.1 29.4 213.5Z"
            />
            <path pathLength="1" d="M29.4 213.5 L61.6 199.4" />
            <path
              pathLength="1"
              d="M35.7 186.5 C35.9 170.1 22.4 156.9 9.3 154.1 C9.4 167.5 19.6 183.4 35.7 186.5Z"
            />
            <path pathLength="1" d="M35.7 186.5 L14.6 160.6" />
            <path
              pathLength="1"
              d="M44.6 159.5 C58.4 166.6 75.4 160.6 83.2 150.6 C71.8 145.0 53.9 147.1 44.6 159.5Z"
            />
            <path pathLength="1" d="M44.6 159.5 L75.5 152.4" />
            <path
              pathLength="1"
              d="M57.1 132.5 C60.6 118.2 51.4 104.0 40.4 99.0 C37.8 110.8 43.6 126.7 57.1 132.5Z"
            />
            <path pathLength="1" d="M57.1 132.5 L43.7 105.7" />
            <path
              pathLength="1"
              d="M73.4 105.5 C84.0 114.4 99.8 112.4 108.6 105.2 C99.7 98.0 83.8 96.4 73.4 105.5Z"
            />
            <path pathLength="1" d="M73.4 105.5 L101.5 105.2" />
            <path
              pathLength="1"
              d="M93.3 78.5 C98.8 66.6 93.1 52.8 84.3 46.8 C80.0 56.6 82.4 71.3 93.3 78.5Z"
            />
            <path pathLength="1" d="M93.3 78.5 L86.1 53.1" />
            <path
              pathLength="1"
              d="M116.4 51.5 C124.6 60.6 138.5 60.7 146.9 55.3 C140.1 48.0 126.5 44.7 116.4 51.5Z"
            />
            <path pathLength="1" d="M116.4 51.5 L140.8 54.6" />
            <path
              pathLength="1"
              d="M145.8 20.0 C136.8 8.0 139.8 -10.0 149.8 -18.0 C159.8 -8.0 155.8 10.0 145.8 20.0Z"
            />
          </symbol>
        </defs>
      </svg>

      <div className="gg-drift" aria-hidden="true" />

      <div className="gg-stage">
        {/* heading */}
        <header className="gg-head">
          <p className="gg-eyebrow">A little world,</p>
          <h2 className="gg-title" id="gg-heading">
            <span className="gg-w">
              <span>Made</span>
            </span>{" "}
            <span className="gg-w">
              <span>by</span>
            </span>{" "}
            <span className="gg-w">
              <span>hand</span>
            </span>
          </h2>
          <p className="gg-lede">
            Every stitch tells a story, of patience, love and little moments that matter.
          </p>
          <svg
            className="gg-stitch"
            viewBox="0 0 160 10"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M2 5 C 22 1 38 9 58 5 S 98 1 118 5 S 148 8 158 4" />
          </svg>
        </header>

        {/* yarn threads winding through the scene */}
        <svg className="gg-thread" viewBox="0 0 1536 1220" aria-hidden="true">
          <path
            pathLength="1"
            d="M372 950 C 440 1010 540 1095 640 1080 S 800 1090 880 1080 S 930 1035 965 1015"
          />
          <path
            pathLength="1"
            d="M742 425 C 790 490 840 530 885 482 S 965 452 1012 505"
          />
        </svg>

        {/* vine photo cut-outs, draw themselves in */}
        <div className="gg-vine gg-vine--1" aria-hidden="true">
          <Image src="/gallery/vine1.webp" alt="" width={1536} height={1024} loading="lazy" />
        </div>
        <div className="gg-vine gg-vine--2" aria-hidden="true">
          <Image src="/gallery/vine2.webp" alt="" width={1536} height={1024} loading="lazy" />
        </div>

        <svg
          className="gg-sprig"
          style={
            { "--x": "17.057", "--y": "2.295", "--w": "4.297", "--r": "-18deg", "--sd": "0.3s" } as React.CSSProperties
          }
          viewBox="0 0 200 260"
          aria-hidden="true"
        >
          <use href="#gg-sprig" />
        </svg>
        <svg
          className="gg-sprig"
          style={
            { "--x": "92.122", "--y": "86.885", "--w": "6.771", "--r": "205deg", "--sd": "0.8s" } as React.CSSProperties
          }
          viewBox="0 0 200 260"
          aria-hidden="true"
        >
          <use href="#gg-sprig" />
        </svg>

        {/* collage pieces */}
        {ITEMS.map((item) => (
          <figure
            key={item.src}
            className={item.circle ? "gg-item gg-circle" : "gg-item"}
            style={
              {
                "--x": item.x,
                "--y": item.y,
                "--w": item.w,
                "--r": item.r,
                "--depth": item.depth,
                "--fade": item.fade,
                "--d": item.d,
                "--fl": item.fl,
                "--fd": item.fd,
                "--blob": item.blob,
              } as React.CSSProperties
            }
          >
            <div className="gg-par">
              <div className="gg-float">
                <span className="gg-blob" aria-hidden="true" />
                <div className="gg-tilt">
                  <Image
                    className="gg-img"
                    src={item.src}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    loading="lazy"
                    sizes="(max-width: 860px) 84vw, 30vw"
                  />
                </div>
              </div>
              {item.cap ? <CaptionArrowCap cap={item.cap} /> : null}
            </div>
          </figure>
        ))}

        <Link className="gg-cta" href="/shop">
          Explore the collection
          <svg viewBox="0 0 28 16" aria-hidden="true">
            <path d="M1 8H26M20 2l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

// figcaption wrapper (kept separate so CaptionArrow stays reusable above)
function CaptionArrowCap({ cap }: { cap: Caption }) {
  const style: React.CSSProperties = {};
  if (cap.ct) (style as React.CSSProperties & { "--ct"?: string })["--ct"] = cap.ct;
  if (cap.maxWidth) style.maxWidth = cap.maxWidth;
  return (
    <figcaption className={`gg-cap gg-cap--${cap.pos}`} style={style}>
      <span>{cap.text}</span>
      <CaptionArrow />
    </figcaption>
  );
}
