"use client";

import { useId, useState, type ReactNode } from "react";

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/**
 * Spec: rows with +/−, subtle #D8DED6 divider, no card chrome, real
 * accordion semantics (button + aria-expanded + aria-controls).
 */
export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="w-full py-4 flex items-center justify-between gap-4 text-left"
      >
        <span className="font-body text-small font-semibold text-charcoal">{title}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
          className="text-sage shrink-0"
        >
          {open ? <path d="M3 8h10" /> : <path d="M8 3v10M3 8h10" />}
        </svg>
      </button>
      <div id={contentId} hidden={!open} className="pb-5">
        <div className="font-body text-small text-muted leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
