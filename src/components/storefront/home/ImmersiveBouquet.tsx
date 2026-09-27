"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/**
 * Immersive bouquet — design spec: full-width centered artwork, no card,
 * scroll-driven entry from ~85% → 100% scale (no autoplay), small message
 * appears bottom-left during scroll, no hard exit, reduced-motion static.
 */
export function ImmersiveBouquet() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      section.style.setProperty("--bouquet-scale", "1");
      section.style.setProperty("--msg-opacity", "1");
      return;
    }

    let frame = 0;
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the section top enters the viewport bottom, 1 when settled
      // into the upper quarter — maps to scale 85% → 100%.
      const progress = clamp01((vh - rect.top) / (vh * 0.75));
      section.style.setProperty("--bouquet-scale", String(0.85 + 0.15 * progress));
      const message = clamp01((vh * 0.7 - rect.top) / (vh * 0.35));
      section.style.setProperty("--msg-opacity", String(message));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Made by hand"
      className="relative bg-cream py-16 lg:py-30 overflow-hidden"
      style={{ ["--bouquet-scale" as string]: "1", ["--msg-opacity" as string]: "0" }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div
          className="mx-auto w-[78%] sm:w-[62%] lg:w-[46%] origin-bottom transition-transform duration-[250ms] ease-media"
          style={{ transform: "scale(var(--bouquet-scale, 1))" }}
        >
          <Image
            src="/florals/sunflower-02.png"
            alt="A crochet sunflower bouquet"
            width={953}
            height={1208}
            sizes="(min-width: 1024px) 46vw, 78vw"
            className="w-full h-auto"
          />
        </div>

        <p
          className="mt-10 max-w-[260px] font-body text-small text-muted transition-opacity duration-[400ms] ease-media"
          style={{ opacity: "var(--msg-opacity, 0)" }}
        >
          Made by hand,
          <br />
          with care in every stitch.
        </p>
      </div>
    </section>
  );
}
