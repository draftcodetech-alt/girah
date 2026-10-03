"use client";

import { useEffect, useRef } from "react";

/**
 * "Handmade Promise" — trust/promise section ported from the approved
 * reference (eyebrow + serif statement + bordered three-card grid + brand
 * note). Palette lives in globals.css scoped to .girah-promise / .hp-*;
 * reveal mirrors GalleryCollage (IntersectionObserver + reduced-motion /
 * no-JS show-everything fallbacks).
 */

const CARDS = [
  {
    title: "Made by Hand",
    body: "Each piece is crocheted carefully in small batches, giving every creation its own tiny details and unmistakable handmade character.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 4C12 4 5 8 4 17" />
        <path d="M4 20C8 15 12 11 18 8" />
        <path d="M9 13C7 12 5 12 4 12" />
      </svg>
    ),
  },
  {
    title: "Packed With Care",
    body: "Your order is wrapped thoughtfully and prepared with the same care we put into every stitch, ready to arrive safely at your doorstep.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5L12 3l8 4.5" />
        <path d="M4 7.5V17l8 4 8-4V7.5" />
        <path d="M12 21V12" />
        <path d="M4 7.5l8 4.5 8-4.5" />
        <path d="M8 5.5l8 4.5" />
      </svg>
    ),
  },
  {
    title: "Made to Be Kept",
    body: "From little gifts to everyday companions, our crochet pieces are made to last, be loved and become part of your story.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 8.8C20.8 5.7 18.5 4 16.1 4C14.4 4 12.9 4.9 12 6.2C11.1 4.9 9.6 4 7.9 4C5.5 4 3.2 5.7 3.2 8.8C3.2 13.7 12 19.5 12 19.5C12 19.5 20.8 13.7 20.8 8.8Z" />
      </svg>
    ),
  },
];

export function HandmadePromise() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".hp-reveal"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("hp-show");
              io.unobserve(e.target);
            }
          }
        },
        { threshold: 0.15 }
      );
      items.forEach((it) => io.observe(it));
      return () => io.disconnect();
    }

    items.forEach((it) => it.classList.add("hp-show"));
  }, []);

  return (
    <div className="girah-promise" ref={rootRef}>
      {/* Decorative botanical artwork (reference: left + right sprigs) */}
      <svg className="hp-leaf hp-leaf-left" viewBox="0 0 180 180" aria-hidden="true">
        <path d="M20 160 C55 125 75 80 160 20" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M53 126 C42 103 31 94 19 90" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M70 107 C73 84 82 73 94 65" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M94 83 C116 83 128 76 136 64" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg className="hp-leaf hp-leaf-right" viewBox="0 0 180 180" aria-hidden="true">
        <path d="M160 20 C120 55 105 100 25 160" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M126 54 C145 53 157 47 166 36" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M103 79 C84 76 73 69 65 57" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M75 112 C55 108 44 100 37 89" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
        <header className="hp-header hp-reveal" style={{ transitionDelay: "0s" }}>
          <p className="hp-eyebrow">Our little promise</p>
          <h2 className="hp-title">
            Made slowly.
            <br />
            <em>Made with heart.</em>
          </h2>
          <p className="hp-intro">
            Every piece begins with a strand of yarn and a pair of caring hands. We create
            small-batch crochet treasures designed to bring a little warmth, beauty and joy
            into everyday moments.
          </p>
        </header>

        <div className="hp-grid">
          {CARDS.map((card, i) => (
            <article
              key={card.title}
              className="hp-card hp-reveal"
              style={{ transitionDelay: `${(i + 1) * 0.1}s` }}
            >
              <div className="hp-icon">{card.icon}</div>
              <h3 className="hp-card-title">{card.title}</h3>
              <p className="hp-card-body">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="hp-note hp-reveal" style={{ transitionDelay: "0.5s" }}>
          <span>A little handmade happiness, just for you.</span>
          <span className="hp-flower">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12C8 8 8 4 12 3C16 4 16 8 12 12Z" />
              <path d="M12 12C16 8 20 9 21 12C20 16 16 16 12 12Z" />
              <path d="M12 12C16 16 15 20 12 21C8 20 8 16 12 12Z" />
              <path d="M12 12C8 16 4 15 3 12C4 8 8 8 12 12Z" />
              <circle cx="12" cy="12" r="1.5" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
