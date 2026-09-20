"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ images, alt }: { images: { url: string }[]; alt: string }) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-4/5 bg-sage-light rounded-[var(--radius-surface)] flex items-center justify-center text-muted">
        No image
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-4/5 rounded-[var(--radius-surface)] overflow-hidden bg-sage-light">
  
        <Image src={images[current].url} alt={alt} fill className="object-cover" priority sizes="(min-width: 1024px) 60vw, 100vw" />
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 font-body text-small bg-charcoal/70 text-cream px-2 py-1 rounded-[var(--radius-control)]">
            {current + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 mt-3">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setCurrent(i)}
              className={`relative aspect-4/5 rounded-[var(--radius-control)] overflow-hidden ${
                i === current ? "ring-2 ring-sage" : "opacity-70"
              }`}
            >
              <Image src={img.url} alt={`${alt} ${i + 1}`} fill className="object-cover" sizes="120px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}