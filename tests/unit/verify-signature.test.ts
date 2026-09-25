import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifySafepaySignature } from "@/modules/payments/verify-webhook";

const SECRET = "unit-webhook-secret";
const BODY = JSON.stringify({ type: "payment.succeeded", data: { amount: 100 } });

function legacySign(body: string, secret: string = SECRET): string {
  return crypto.createHmac("sha512", secret).update(body).digest("hex");
}

function timestampedSign(body: string, timestamp: string, secret: string = SECRET): string {
  const key = Buffer.from(secret, "base64");
  return "sha256=" + crypto.createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
}

describe("verifySafepaySignature", () => {
  const original = process.env.SAFEPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.SAFEPAY_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SAFEPAY_WEBHOOK_SECRET;
    else process.env.SAFEPAY_WEBHOOK_SECRET = original;
  });

  it("accepts the legacy HMAC-SHA512 raw-body signature", () => {
    expect(verifySafepaySignature(BODY, legacySign(BODY))).toBe(true);
  });

  it("accepts the legacy signature regardless of hex casing in the header", () => {
    expect(verifySafepaySignature(BODY, legacySign(BODY).toUpperCase())).toBe(true);
    expect(verifySafepaySignature(BODY, legacySign(BODY).toLowerCase())).toBe(true);
  });

  it("rejects a legacy signature made with the wrong secret", () => {
    expect(verifySafepaySignature(BODY, legacySign(BODY, "wrong-secret"))).toBe(false);
  });

  it("rejects a legacy signature over a tampered body", () => {
    const other = BODY.replace("100", "999");
    expect(verifySafepaySignature(other, legacySign(BODY))).toBe(false);
  });

  it("rejects a missing or empty signature header", () => {
    expect(verifySafepaySignature(BODY, null)).toBe(false);
    expect(verifySafepaySignature(BODY, "")).toBe(false);
  });

  it("fails closed when the webhook secret is not configured", () => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
    expect(verifySafepaySignature(BODY, legacySign(BODY))).toBe(false);
  });

  it("accepts the timestamped SHA-256 scheme with a fresh timestamp", () => {
    const ts = new Date().toISOString();
    expect(verifySafepaySignature(BODY, timestampedSign(BODY, ts), ts)).toBe(true);
  });

  it("accepts the timestamped scheme with uppercase hex after the prefix", () => {
    const ts = new Date().toISOString();
    expect(verifySafepaySignature(BODY, timestampedSign(BODY, ts).toUpperCase(), ts)).toBe(true);
  });

  it("rejects the timestamped scheme with a stale timestamp (replay window)", () => {
    const ts = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(verifySafepaySignature(BODY, timestampedSign(BODY, ts), ts)).toBe(false);
  });

  it("rejects the timestamped scheme when the body was tampered with", () => {
    const ts = new Date().toISOString();
    const other = BODY.replace("100", "999");
    expect(verifySafepaySignature(other, timestampedSign(BODY, ts), ts)).toBe(false);
  });

  it("rejects a sha256= header without a timestamp", () => {
    expect(verifySafepaySignature(BODY, timestampedSign(BODY, new Date().toISOString()), null)).toBe(
      false
    );
  });

  it("rejects a timestamped signature computed with the legacy (non-base64) key derivation", () => {
    const ts = new Date().toISOString();
    const wrong = "sha256=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${BODY}`).digest("hex");
    expect(verifySafepaySignature(BODY, wrong, ts)).toBe(false);
  });
});
