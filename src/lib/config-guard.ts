/**
 * Production boot guard: fails LOUD on the first request when the deploy
 * is misconfigured, instead of silently degrading (wrong email sender,
 * broken webhook verification, untrusted host). Skipped outside
 * production so every test suite and the dev server boot untouched.
 * Edge-safe (no Buffer/Node APIs) — called from proxy.ts.
 */
let checked = false;

function isPlausibleBase64(secret: string): boolean {
  return secret.length >= 16 && secret.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(secret);
}

export function assertProdConfig(): void {
  if (checked || process.env.NODE_ENV !== "production") return;
  checked = true;
  const problems: string[] = [];
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    problems.push("NEXT_PUBLIC_APP_URL is not set (trustHost + absolute links depend on it)");
  }
  if (!process.env.EMAIL_FROM) {
    problems.push("EMAIL_FROM is not set — senders fall back to onboarding@resend.dev");
  }
  const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET;
  if (webhookSecret && !isPlausibleBase64(webhookSecret)) {
    problems.push("SAFEPAY_WEBHOOK_SECRET is not base64 — the v1 webhook path can never verify");
  }
  if (problems.length > 0) {
    throw new Error(`Invalid production config:\n- ${problems.join("\n- ")}`);
  }
}
