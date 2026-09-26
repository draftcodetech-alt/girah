// The ONE money formatter for the app. Input is always integer paisa
// (contextopencode.md §8) — output is deterministic 2-decimal rupees
// regardless of runtime locale defaults (Node vs browser Intl can otherwise
// disagree on trailing digits). Format: "Rs. 1,000.00".
export function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// The ONE date formatter. An explicit timezone keeps "Placed …"/"Joined …"
// identical on any host (a UTC deployment otherwise renders yesterday's date
// for a PK visitor). Format: "26 Sept 2026".
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
