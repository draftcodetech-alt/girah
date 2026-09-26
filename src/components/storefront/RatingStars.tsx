type RatingStarsProps = {
  average: number;
  count?: number;
};

export function RatingStars({ average, count }: RatingStarsProps) {
  const rounded = Math.max(1, Math.min(5, Math.round(average)));
  const label =
    count !== undefined
      ? `Rated ${average} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`
      : `Rated ${average} out of 5`;

  return (
    <span
      className="inline-flex items-center gap-1.5 font-body text-small text-gold"
      aria-label={label}
    >
      <span aria-hidden="true">
        {"★".repeat(rounded)}
        {"☆".repeat(5 - rounded)}
      </span>
      <span aria-hidden="true" className="text-sage">
        {average.toFixed(1)}
        {count !== undefined ? ` (${count})` : ""}
      </span>
    </span>
  );
}
