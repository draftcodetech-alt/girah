import crypto from "crypto";

// Safepay has documented TWO webhook signature schemes across API
// generations — we accept either (both keyed by the same shared secret, so
// accepting both adds no attack surface):
//
// 1. Legacy (current integration, real-test confirmed): HMAC-SHA512 over the
//    raw request body, hex digest, compared against X-SFPY-SIGNATURE.
//    https://safepay.helpscoutdocs.com/article/173-asp-net-integration-guide
// 2. v1/Raast (new docs): HMAC-SHA256 over `X-SFPY-TIMESTAMP + "." + rawBody`,
//    key = base64-decoded secret, digest formatted `sha256=<lowercase hex>`.
//    https://safepay.mintlify.app/guides/webhooks-delivery
//
// Hex comparison is case-insensitive (both schemes' docs emit lowercase, but
// header casing must never break verification — this was a filed finding).
export function verifySafepaySignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null = null
): boolean {
  if (!signatureHeader) return false;

  const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration must fail CLOSED and be loud — never proceed with an
    // undefined HMAC key (createHmac would throw a confusing 500).
    console.error("SAFEPAY_WEBHOOK_SECRET is not configured — webhook verification impossible.");
    return false;
  }

  const received = signatureHeader.trim().toLowerCase();

  // Scheme 1: raw-body HMAC-SHA512.
  if (verifyLegacy(rawBody, secret, received)) return true;

  // Scheme 2: timestamp-prefixed HMAC-SHA256 with `sha256=` prefix.
  if (verifyTimestamped(rawBody, secret, received, timestampHeader)) return true;

  return false;
}

function safeEqual(expectedHex: string, received: string): boolean {
  // timingSafeEqual throws on length mismatch — compare lengths first.
  const expectedBuf = Buffer.from(expectedHex);
  const receivedBuf = Buffer.from(received);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function verifyLegacy(rawBody: string, secret: string, received: string): boolean {
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return safeEqual(expected, received);
}

function verifyTimestamped(
  rawBody: string,
  secret: string,
  received: string,
  timestamp: string | null
): boolean {
  if (!timestamp || !received.startsWith("sha256=")) return false;

  // Replay window: reject stale timestamps (docs recommend ~5 minutes).
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed) || Math.abs(Date.now() - parsed) > 5 * 60 * 1000) return false;

  const key = Buffer.from(secret, "base64");
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
  return safeEqual(expected, received);
}
