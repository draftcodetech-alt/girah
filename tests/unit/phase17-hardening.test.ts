import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17 hardening: global security headers (with Auth.js's own endpoints
// excluded from the middleware), the registration throttle, the dependency
// audit override, and gitignore hygiene for Cloudflare artifacts.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Phase 17: proxy security headers", () => {
  const proxy = readSource("src/proxy.ts");

  it("matches everything except Auth.js's own endpoints", () => {
    // Wrapping /api/auth/* adds a second, divergent csrf cookie (runtime
    // merge order differs) → MissingCSRF in browsers. Must stay excluded.
    expect(proxy).toContain('matcher: ["/((?!api/auth/).*)"]');
  });

  it("ships the core headers", () => {
    expect(proxy).toContain("Content-Security-Policy");
    expect(proxy).toContain("X-Content-Type-Options");
    expect(proxy).toContain("nosniff");
    expect(proxy).toContain("X-Frame-Options");
    expect(proxy).toContain("DENY");
    expect(proxy).toContain("Referrer-Policy");
    expect(proxy).toContain("Permissions-Policy");
  });

  it("CSP is same-origin with Next-required inline allowances", () => {
    expect(proxy).toContain("default-src 'self'");
    expect(proxy).toContain("script-src 'self' 'unsafe-inline'");
    expect(proxy).toContain("frame-ancestors 'none'");
    expect(proxy).toContain("object-src 'none'");
    expect(proxy).toContain("form-action 'self'");
    // No third-party script origins — the app ships none. (Single-line check:
    // the source builds the header from an array, so only the script-src
    // line itself matters.)
    expect(proxy).not.toMatch(/script-src[^;\n]*https:/);
  });

  it("dev keeps HMR working; production is tight", () => {
    expect(proxy).toContain("isDev");
    expect(proxy).toContain("ws: wss:"); // dev-only connect-src
    expect(proxy).toContain("upgrade-insecure-requests"); // production-only
    expect(proxy).toContain("Strict-Transport-Security");
    // HSTS must be gated — forcing https on localhost bricks local preview.
    expect(proxy).toMatch(/if \(!isDev\) \{[\s\S]*Strict-Transport-Security/);
  });

  it("headers ride every exit path, redirects included", () => {
    expect(proxy).toContain("const respond = (res: NextResponse)");
    expect(proxy).toMatch(/return respond\(loginUrl\(\)\)/);
    expect(proxy).toMatch(/return respond\(NextResponse\.redirect/);
    expect(proxy).toMatch(/return respond\(NextResponse\.next\(\)/);
  });

  it("keeps the original auth gates untouched", () => {
    expect(proxy).toMatch(/isAccountRoute \|\| isWishlistRoute/);
    expect(proxy).toMatch(/role !== "ADMIN"/);
  });
});

describe("Phase 17: registration throttle", () => {
  const actions = readSource("src/modules/accounts/actions.ts");

  it("keys on the real client IP with a sane fallback", () => {
    expect(actions).toContain("cf-connecting-ip");
    expect(actions).toContain("x-forwarded-for");
    expect(actions).toContain("register:");
    // Non-request contexts (integration tests) degrade instead of throwing.
    expect(actions).toContain("catch");
  });

  it("counts every attempt before the existence check", () => {
    const limitedAt = actions.indexOf("isRateLimited(rateKey, REGISTER_RATE)");
    const existsAt = actions.indexOf("db.user.findFirst");
    expect(limitedAt).toBeGreaterThan(-1);
    expect(existsAt).toBeGreaterThan(limitedAt);
  });

  it("uses the shared bucket logic and skips NODE_ENV=test", () => {
    expect(actions).toContain("REGISTER_RATE");
    expect(actions).toContain("recordFailure(rateKey, REGISTER_RATE)");
    expect(actions).toContain('process.env.NODE_ENV !== "test"');
  });

  it("password reset keeps its existing per-email throttle", () => {
    expect(actions).toContain("pwreset:");
    expect(actions).toContain("RESET_RATE");
  });
});

describe("Phase 17: dependency + repo hygiene", () => {
  it("overrides the vulnerable deepmerge-ts (advisory fixed in 8.x)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.overrides?.["deepmerge-ts"]).toMatch(/\^8\./);
  });

  it("gitignores wrangler's local state", () => {
    const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toContain(".wrangler/");
    expect(gitignore).toContain(".open-next/");
  });
});
