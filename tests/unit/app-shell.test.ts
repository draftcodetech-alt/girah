import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 7: the storefront Header used to mount inside the root layout, so the
// admin console rendered storefront chrome (Cart badge, "Sign In"). The Header
// moved into (storefront)/(auth)/account layouts, and the app gained a full
// loading/404/error boundary set.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(join(ROOT, relativePath));
}

const HEADER_LAYOUTS = [
  "src/app/(storefront)/layout.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/account/layout.tsx",
];

const SPECIAL_FILES = [
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/(storefront)/loading.tsx",
  "src/app/(storefront)/not-found.tsx",
  "src/app/account/loading.tsx",
  "src/app/admin/loading.tsx",
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else out.push(full);
  }
  return out;
}

describe("app shell: Header scoping", () => {
  it("root layout renders no storefront Header", () => {
    const root = readSource("src/app/layout.tsx");
    expect(root).not.toMatch(/Header/);
  });

  it.each(HEADER_LAYOUTS)("%s renders the Header", (relativePath) => {
    expect(readSource(relativePath)).toMatch(/<Header\s*\/>/);
  });

  it("admin has no storefront Header in its layout", () => {
    expect(readSource("src/app/admin/layout.tsx")).not.toMatch(/<Header\s*\/>/);
  });
});

describe("app shell: loading / 404 / error boundaries", () => {
  it.each(SPECIAL_FILES)("%s exists", (relativePath) => {
    expect(exists(relativePath)).toBe(true);
  });

  it("error.tsx uses Next 16's `retry` prop (not `reset`)", () => {
    const source = readSource("src/app/error.tsx");
    expect(source).toMatch(/\bretry\b/);
    expect(source).not.toMatch(/\breset\b/);
  });

  it("global-error.tsx renders its own html/body", () => {
    const source = readSource("src/app/global-error.tsx");
    expect(source).toMatch(/<html/);
    expect(source).toMatch(/<body/);
  });

  it("not-found views render the shared NotFoundView", () => {
    expect(readSource("src/app/not-found.tsx")).toMatch(/NotFoundView/);
    expect(readSource("src/app/(storefront)/not-found.tsx")).toMatch(
      /NotFoundView/
    );
  });
});

describe("app shell: Phase 7 cruft removal", () => {
  it("no test-payment-guard demo route", () => {
    expect(exists("src/app/test-payment-guard")).toBe(false);
  });

  it("no standalone logout-action module", () => {
    expect(exists("src/modules/accounts/logout-action.ts")).toBe(false);
  });

  it("homepage lives in the (storefront) route group", () => {
    expect(exists("src/app/(storefront)/page.tsx")).toBe(true);
    expect(exists("src/app/page.tsx")).toBe(false);
  });

  it("no raw toLocaleDateString rendering left in src/", () => {
    const offenders = listSourceFiles(join(ROOT, "src"))
      .filter((file) => /toLocaleDateString/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
