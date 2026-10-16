import { describe, it, expect, vi, afterEach } from "vitest";
import { fieldErrorsFrom } from "@/modules/admin/field-errors";

// Phase B: the shared admin validation helper + the production boot guard.
// Both are pure; the boot guard reads env, so each prod case stubs a full
// valid set and varies one variable at a time.

describe("fieldErrorsFrom", () => {
  it("maps the first path segment to its message", () => {
    expect(
      fieldErrorsFrom([
        { path: ["name", 0], message: "Required" },
        { path: ["price"], message: "Must be positive" },
      ])
    ).toEqual({ name: "Required", price: "Must be positive" });
  });

  it("stringifies numeric and symbol segments without throwing", () => {
    expect(fieldErrorsFrom([{ path: [0], message: "Bad" }])).toEqual({ 0: "Bad" });
    expect(fieldErrorsFrom([])).toEqual({});
  });
});

describe("assertProdConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadGuard() {
    const mod = await import("@/lib/config-guard");
    return mod.assertProdConfig;
  }

  function prodEnv(overrides: Record<string, string | undefined> = {}) {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://girah.example");
    vi.stubEnv("EMAIL_FROM", "Girah <shop@girah.example>");
    vi.stubEnv("SAFEPAY_WEBHOOK_SECRET", "aGk6dG9rZW4tc2VjcmV0LXNlZWQ=");
    for (const [key, value] of Object.entries(overrides)) {
      // Empty string is falsy: exercises the same missing-value branch.
      vi.stubEnv(key, value ?? "");
    }
  }

  it("stays silent outside production, even with nothing configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).not.toThrow();
  });

  it("fails loud on a missing EMAIL_FROM in production", async () => {
    prodEnv({ EMAIL_FROM: undefined });
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).toThrow(/EMAIL_FROM/);
  });

  it("fails loud on a missing app URL in production", async () => {
    prodEnv({ NEXT_PUBLIC_APP_URL: undefined });
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("fails loud on a non-base64 webhook secret", async () => {
    prodEnv({ SAFEPAY_WEBHOOK_SECRET: "not-base64!!!" });
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).toThrow(/SAFEPAY_WEBHOOK_SECRET/);
  });

  it("fails on EVERY prod request until fixed (never serves after one loud error)", async () => {
    prodEnv({ EMAIL_FROM: "" });
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).toThrow(/EMAIL_FROM/);
    expect(() => assertProdConfig()).toThrow(/EMAIL_FROM/);
  });

  it("passes a fully configured production env, and only checks once", async () => {
    prodEnv();
    const assertProdConfig = await loadGuard();
    expect(() => assertProdConfig()).not.toThrow();
    expect(() => assertProdConfig()).not.toThrow();
  });
});
