import crypto from "crypto";

// Confirmed from Safepay's official HMAC verification docs:
// HMAC-SHA512 over the raw request body, compared against the
// X-SFPY-SIGNATURE header.
export function verifySafepaySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha512", process.env.SAFEPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  // Timing-safe comparison — prevents a timing-attack from guessing the
  // signature byte by byte. Both buffers must be equal length first, or
  // timingSafeEqual throws instead of returning false.
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
