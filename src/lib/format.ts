// The ONE money formatter for the app. Input is always integer paisa
// (girah.md §3.4 / implementation-plan.md Phase 5) — output is deterministic
// 2-decimal rupees regardless of runtime locale defaults (Node vs browser
// Intl can otherwise disagree on trailing digits). Format: "Rs. 1,000.00".
export function formatPrice(paisa: number): string {
  return `Rs. ${(paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
