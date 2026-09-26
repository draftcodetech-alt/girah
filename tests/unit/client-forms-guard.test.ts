import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const CLIENT_FORMS = [
  "src/components/storefront/LoginForm.tsx",
  "src/components/storefront/RegisterForm.tsx",
  "src/components/storefront/ProfileForm.tsx",
  "src/components/storefront/CheckoutForm.tsx",
  "src/components/admin/ProductForm.tsx",
  "src/components/admin/VariationRow.tsx",
];

const FEEDBACK_UI = [
  ...CLIENT_FORMS,
  "src/components/admin/AdminOrderRow.tsx",
  "src/components/admin/ToggleActiveButton.tsx",
];

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("client forms use onSubmit, not action={fn}", () => {
  it.each(CLIENT_FORMS)("%s has no <form action={...}>", (relativePath) => {
    expect(readSource(relativePath)).not.toMatch(/<form[^>]*\baction=\{/);
  });

  it.each(CLIENT_FORMS)("%s submits through onSubmit", (relativePath) => {
    expect(readSource(relativePath)).toMatch(/<form[^>]*\bonSubmit=\{/);
  });

  it.each(CLIENT_FORMS)("%s prevents the native submit and reads FormData first", (relativePath) => {
    const source = readSource(relativePath);
    expect(source).toMatch(/event\.preventDefault\(\)/);
    expect(source).toMatch(/new FormData\(event\.currentTarget\)/);
  });
});

describe("failure feedback stays reachable to assistive tech", () => {
  it.each(FEEDBACK_UI)("%s renders errors with role=\"alert\"", (relativePath) => {
    expect(readSource(relativePath)).toMatch(/role="alert"/);
  });

  it("ProfileForm announces success with role=\"status\"", () => {
    expect(readSource("src/components/storefront/ProfileForm.tsx")).toMatch(/role="status"/);
  });

  it.each([
    "src/components/admin/AdminOrderRow.tsx",
    "src/components/admin/VariationRow.tsx",
    "src/components/admin/ToggleActiveButton.tsx",
  ])("%s surfaces a refused server action result", (relativePath) => {
    const source = readSource(relativePath);
    expect(source).toMatch(/result\.success/);
    expect(source).toMatch(/setError\(/);
  });
});
