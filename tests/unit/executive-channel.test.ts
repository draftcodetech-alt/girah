import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { isChannelAllowed } from "@/lib/channel-gate";

// Owner spec change (2026-10-24): Girah is a SINGLE-OWNER store.
//   • Exactly one admin account may ever exist — a partial unique index in
//     the database refuses a second one, from any code path.
//   • Admin sign-in is NOT on the storefront /login. It lives at
//     /executive/login, typed manually into the URL — never linked, never
//     indexed, never in the sitemap.
//   • The channel gate lives in authorize() (lib/auth.ts), the credential
//     choke point every login passes through — including a raw POST to
//     /api/auth/callback/credentials. The login() action re-checks the same
//     shared rule before doing any credential work.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("channel gate rule (pure)", () => {
  it("lets the admin in only through the executive door", () => {
    expect(isChannelAllowed("ADMIN", "executive")).toBe(true);
    expect(isChannelAllowed("ADMIN", "customer")).toBe(false);
    // Missing/garbage channel = storefront channel by definition.
    expect(isChannelAllowed("ADMIN", undefined)).toBe(false);
    expect(isChannelAllowed("ADMIN", "EXECUTIVE")).toBe(false);
  });

  it("lets customers in only through the storefront", () => {
    expect(isChannelAllowed("CUSTOMER", "customer")).toBe(true);
    expect(isChannelAllowed("CUSTOMER", undefined)).toBe(true);
    expect(isChannelAllowed("CUSTOMER", "executive")).toBe(false);
  });
});

describe("authorize() holds the gate at the credential choke point", () => {
  const auth = readSource("src/lib/auth.ts");

  it("accepts a channel credential (so raw /api/auth posts carry it too)", () => {
    expect(auth).toContain('channel: { label: "Channel", type: "text" }');
  });

  it("checks the channel AFTER the password and BEFORE the failure budget resets", () => {
    const passwordAt = auth.indexOf("if (!isValidPassword)");
    const gateAt = auth.indexOf("isChannelAllowed(user.role, credentials.channel)");
    const resetAt = auth.indexOf("resetRateLimit(rateKey)");
    expect(passwordAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(passwordAt);
    expect(resetAt).toBeGreaterThan(gateAt);
  });

  it("refuses a wrong channel exactly like a wrong password, and never resets the budget", () => {
    const gateBlock = auth.slice(
      auth.indexOf("isChannelAllowed(user.role, credentials.channel)"),
      auth.indexOf("resetRateLimit(rateKey)")
    );
    expect(gateBlock).toContain("recordFailure(rateKey)");
    expect(gateBlock).toContain("return null");
  });
});

describe("login() action re-checks the same rule", () => {
  const actions = readSource("src/modules/accounts/actions.ts");

  it("gate runs before signIn and answers with the generic message", () => {
    const gateAt = actions.indexOf("isChannelAllowed(candidate.role, parsed.data.channel)");
    const signInAt = actions.indexOf('signIn("credentials"');
    expect(gateAt).toBeGreaterThan(-1);
    expect(signInAt).toBeGreaterThan(gateAt);
    expect(actions).toContain('error: "Invalid email or password."');
  });

  it("passes the channel through to signIn", () => {
    expect(actions).toMatch(/channel: parsed\.data\.channel/);
  });

  it("register() still hardcodes CUSTOMER — signup can never mint an admin", () => {
    expect(actions).toContain('role: "CUSTOMER"');
    expect(actions).not.toMatch(/role:\s*parsed\.data\.role/);
  });
});

describe("loginSchema defaults to the storefront channel", () => {
  const schema = readSource("src/modules/accounts/schema.ts");

  it("channel is a two-value enum defaulting to customer", () => {
    expect(schema).toContain('channel: z.enum(["customer", "executive"]).default("customer")');
  });
});

describe("proxy: /admin bounces to the executive door", () => {
  const proxy = readSource("src/proxy.ts");

  it("builds an executive login URL with the callback", () => {
    expect(proxy).toContain('new URL("/executive/login", req.nextUrl.origin)');
    expect(proxy).toMatch(/if \(!isLoggedIn\) return respond\(executiveLoginUrl\(\)\)/);
  });

  it("customer gates still bounce to the storefront /login", () => {
    // /account, /cart, /checkout etc. keep the customer channel — the admin
    // door must not leak into ordinary storefront redirects.
    expect(proxy).toMatch(/return respond\(loginUrl\(\)\)/);
    expect(proxy).toContain('new URL("/login", req.nextUrl.origin)');
  });

  it("the door itself is reachable signed-out and hands sessions off", () => {
    expect(proxy).toContain('pathname.startsWith("/executive")');
    expect(proxy).toMatch(/role === "ADMIN" \? "\/admin" : "\/"/);
  });
});

describe("the executive door page", () => {
  const page = readSource("src/app/(auth)/executive/login/page.tsx");
  const form = readSource("src/components/storefront/ExecutiveLoginForm.tsx");
  const sitemap = readSource("src/app/sitemap.ts");

  it("exists, is titled, and is noindex", () => {
    expect(page).toContain("Executive Login");
    expect(page).toMatch(/robots:\s*{\s*index:\s*false/);
  });

  it("posts the executive channel and lands on /admin", () => {
    expect(form).toContain('channel: "executive"');
    expect(form).toContain('safeCallbackUrl(callbackUrl, "/admin")');
  });

  it("is not linked from the sitemap", () => {
    expect(sitemap).not.toContain("executive");
  });
});

describe("database invariant: one admin, ever", () => {
  const migration = readSource("prisma/migrations/20261024080000_single_admin/migration.sql");

  it("a partial unique index pins role=ADMIN to a single row", () => {
    expect(migration).toContain(
      `CREATE UNIQUE INDEX "User_single_admin" ON "User"("role") WHERE "role" = 'ADMIN';`
    );
  });
});
