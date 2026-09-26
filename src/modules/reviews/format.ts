// Storefront privacy rule (Phase 10): reviewers show as "First L." — enough
// identity to feel real without exposing the full account name.
export function formatReviewerName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Anonymous";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];

  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}
