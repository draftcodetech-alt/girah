"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <p className="font-body text-label font-semibold tracking-[0.08em] uppercase text-error">
        Something went wrong
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mt-3">
        Unexpected error
      </h1>
      <p className="font-body text-body text-muted mt-4 max-w-[440px]">
        This page could not be loaded right now. Please try again
        {error.digest ? ` (reference ${error.digest})` : "."}
      </p>
      <button
        onClick={() => retry()}
        className="h-12 px-6 mt-8 rounded-[var(--radius-control)] bg-sage text-cream font-body text-button font-semibold"
      >
        Try Again
      </button>
    </div>
  );
}
