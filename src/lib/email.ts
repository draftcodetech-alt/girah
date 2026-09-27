// Phase 14: transactional email transport. Everything is lazy — importing
// this module never needs credentials, so every test suite and server build
// can load it safely (the image-ops ensureCloudinary pattern).
//
// Dev-log fallback (§2 user decision): with no RESEND_API_KEY (or the CI
// placeholder) every send prints to the server log instead of hitting the
// network. Adding a real key later activates real sends with ZERO code
// change — same module, same call sites.

type SendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type ResendLike = { emails: { send(payload: SendEmailPayload): Promise<unknown> } };

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

// Verified-sender default: Resend's onboarding sender works without a custom
// domain; override with EMAIL_FROM once a domain is verified.
const DEFAULT_FROM = "Girah <onboarding@resend.dev>";

let resendClient: ResendLike | null = null;

/** No usable key (missing or CI placeholder) → log instead of sending. */
export function isEmailDevLogMode(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !key || key === "ci-placeholder";
}

async function ensureResend(): Promise<ResendLike> {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "ci-placeholder") {
    // Defensive: callers check isEmailDevLogMode() first. Never construct
    // Resend with a missing key (import-time crash risk for every suite).
    throw new Error("RESEND_API_KEY is not configured");
  }
  const mod = await import("resend");
  const ResendCtor = (mod as { Resend: new (apiKey: string) => ResendLike }).Resend;
  resendClient = new ResendCtor(key);
  return resendClient;
}

/**
 * Throws on real transport failure — use sendEmailSafe from hooks, or this
 * directly in tests that want to observe the error.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (isEmailDevLogMode()) {
    console.log(`[email] dev-log → to=${input.to} subject="${input.subject}"`);
    return;
  }
  const client = await ensureResend();
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
  });
}

/**
 * Best-effort send for post-commit hooks: NEVER throws, so an email problem
 * can never fail an order, webhook, registration or status change (the
 * Safepay-URL swallow-and-log rule applied to email).
 */
export async function sendEmailSafe(input: SendEmailInput): Promise<void> {
  try {
    await sendEmail(input);
  } catch (error) {
    console.error(`[email] send failed → ${input.to} "${input.subject}":`, error);
  }
}
