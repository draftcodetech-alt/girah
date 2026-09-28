import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17: the seed must never run against production unattended, and a
// production run must create a REAL admin instead of the DevAdmin fixture.
// (The four execution paths — dev, prod-no-flag, flag-no-admin, full prod —
// are exercised in the gate notes; here we pin the source contract.)

const ROOT = new URL("../..", import.meta.url).pathname;
const seed = readFileSync(join(ROOT, "prisma/seed.ts"), "utf8");

describe("prisma/seed.ts production guard", () => {
  it("detects production-like environments two ways", () => {
    expect(seed).toContain('process.env.NODE_ENV === "production"');
    expect(seed).toContain("NEXT_PUBLIC_APP_URL");
    expect(seed).toMatch(/startsWith\("https:\/\//);
    expect(seed).toMatch(/localhost\|127\\.0\\.0\\.1/);
  });

  it("refuses without ALLOW_PROD_SEED=1 and says how to proceed", () => {
    expect(seed).toContain('process.env.ALLOW_PROD_SEED !== "1"');
    expect(seed).toContain("ALLOW_PROD_SEED=1");
    expect(seed).toContain("ADMIN_EMAIL");
    expect(seed).toContain("ADMIN_PASSWORD");
  });

  it("requires real admin credentials before any production write", () => {
    // The strength/absence check happens inside assertSeedAllowed(), before
    // main() touches the database.
    expect(seed.indexOf("function assertSeedAllowed")).toBeLessThan(seed.indexOf("async function main"));
    expect(seed).toMatch(/password\.length < 8/);
    expect(seed.indexOf("assertSeedAllowed()")).toBeLessThan(seed.indexOf("prisma.user.upsert"));
  });

  it("creates exactly one credential set per environment", () => {
    // Dev fixtures are hashed only in the else-branch of isProductionLike.
    expect(seed).toContain("DevAdmin123!");
    expect(seed).toContain("dev-customer@girah.test");
    expect(seed).toMatch(/if \(isProductionLike\) \{[\s\S]*prodAdmin = \{[\s\S]*\} else \{[\s\S]*devAdminHash/);
    // The fixture upserts are guarded by their null checks.
    expect(seed).toMatch(/if \(devAdminHash !== null\)/);
    expect(seed).toMatch(/if \(devCustomerHash !== null\)/);
    expect(seed).toMatch(/if \(prodAdmin\)/);
  });

  it("catalog upserts stay outside the guard (real content, both envs)", () => {
    expect(seed).toContain('slug: "crochet-sunflower-bouquet"');
    expect(seed).toContain("assertSeedAllowed");
    // Catalog code must not sit inside the prod-only branch.
    const guardAt = seed.indexOf("function assertSeedAllowed");
    const catalogAt = seed.indexOf("crochet-sunflower-bouquet");
    expect(catalogAt).toBeGreaterThan(guardAt);
  });
});
