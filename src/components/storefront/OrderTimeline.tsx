import type { OrderStatus } from "@prisma/client";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "Placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PROCESSING", label: "Preparing" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "DELIVERED", label: "Delivered" },
];

/**
 * Order progress timeline for the confirmation page — driven entirely by the
 * live orderStatus (plus the CANCELLED terminal branch). Server-rendered,
 * token-only, screen-reader honest via aria-current="step". Takes a plain
 * string because OrderView (the bearer-safe confirmation shape) types
 * statuses as strings.
 */
export function OrderTimeline({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <p role="status" className="font-body text-small font-medium text-error mt-6">
        This order was cancelled — nothing further will happen.
      </p>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <ol aria-label="Order progress" className="flex items-start justify-center gap-1 sm:gap-2 mt-8">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li
            key={step.status}
            aria-current={current ? "step" : undefined}
            className="flex flex-1 flex-col items-center gap-1.5 last:flex-none sm:last:flex-1"
          >
            <span
              aria-hidden="true"
              className={`grid h-7 w-7 place-items-center rounded-full border text-small font-semibold ${
                done
                  ? "border-sage bg-sage text-cream"
                  : current
                    ? "border-sage text-sage"
                    : "border-border text-placeholder"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`font-body text-small text-center leading-tight ${
                done || current ? "text-charcoal font-medium" : "text-placeholder"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
