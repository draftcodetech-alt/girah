import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17: six content pages + the footer Information column. Pages ship as
// skeletons with VISIBLE [placeholder] markers — never invented business facts.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

const PAGES = [
  { slug: "about", file: "src/app/(storefront)/about/page.tsx", title: "About" },
  { slug: "contact", file: "src/app/(storefront)/contact/page.tsx", title: "Contact" },
  { slug: "shipping", file: "src/app/(storefront)/shipping/page.tsx", title: "Shipping & Delivery" },
  { slug: "returns", file: "src/app/(storefront)/returns/page.tsx", title: "Returns & Refunds" },
  { slug: "privacy", file: "src/app/(storefront)/privacy/page.tsx", title: "Privacy Policy" },
  { slug: "terms", file: "src/app/(storefront)/terms/page.tsx", title: "Terms of Service" },
];

describe("Phase 17: six content pages exist", () => {
  for (const page of PAGES) {
    it(`/${page.slug} is a real route with metadata + the shared shell`, () => {
      expect(existsSync(join(ROOT, page.file))).toBe(true);
      const source = readSource(page.file);
      expect(source).toContain("export const metadata");
      expect(source).toContain(`title: "${page.title}"`);
      // About ships the full reference design (AboutSections) instead of the
      // 720px text shell; the other five keep ContentPage.
      if (page.slug === "about") {
        expect(source).toContain("AboutSections");
      } else {
        expect(source).toContain("ContentPage");
      }
      // Inside the (storefront) segment → inherits header/footer.
      expect(page.file).toContain("(storefront)");
    });
  }
});

describe("Phase 17: skeletons carry visible placeholders, no invented facts", () => {
  it("returns defers the policy window + refund timing to the owner", () => {
    const source = readSource("src/app/(storefront)/returns/page.tsx");
    expect((source.match(/\[placeholder/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("order number");
  });

  it("privacy marks retention + business details as undecided", () => {
    const source = readSource("src/app/(storefront)/privacy/page.tsx");
    expect(source).toContain("last updated");
    expect(source).toContain("retention periods");
    expect(source).toContain("legal entity");
    // Real app facts it MAY state:
    expect(source).toContain("salted hash");
    expect(source).toContain("No third-party analytics");
  });

  it("terms defers liability + governing law", () => {
    const source = readSource("src/app/(storefront)/terms/page.tsx");
    expect(source).toContain("Governing law");
    expect(source).toContain("limit-of-liability");
    // Links the real returns page rather than restating policy.
    expect(source).toContain('href="/returns"');
  });

  it("about ships the reference copy and links the shop", () => {
    const source = readSource("src/app/(storefront)/about/page.tsx");
    const sections = readSource("src/components/storefront/about/AboutSections.tsx");
    const all = source + sections;
    expect(all).toContain("made to order");
    expect(all).toContain('href="/shop"');
    // The old placeholder founder's story is gone — reference copy ships.
    expect(all).not.toContain("[placeholder");
    for (const lock of ["What We Make", "How It Works", "Our Story", "Islamabad and Lahore"]) {
      expect(all).toContain(lock);
    }
    // Reference imagery ships from /public/about.
    expect(existsSync(join(ROOT, "public/about/sunflower.webp"))).toBe(true);
    expect(existsSync(join(ROOT, "public/about/make-how.webp"))).toBe(true);
    expect(all).toContain("/about/sunflower.webp");
    expect(all).toContain("/about/make-how.webp");
  });

  it("contact renders only configured channels", () => {
    const source = readSource("src/app/(storefront)/contact/page.tsx");
    expect(source).toContain("NEXT_PUBLIC_CONTACT_EMAIL");
    expect(source).toContain("NEXT_PUBLIC_WHATSAPP_URL");
    expect(source).toContain("channels.length > 0");
  });

  it("shipping states the known storefront facts (free, COD, Safepay)", () => {
    const source = readSource("src/app/(storefront)/shipping/page.tsx");
    expect(source).toContain("Shipping is free");
    expect(source).toContain("Cash on delivery");
    expect(source).toContain("JazzCash");
    expect(source).toContain("[placeholder");
  });
});

describe("Phase 17: footer Information column", () => {
  const footer = readSource("src/components/shared/Footer.tsx");

  it("links exactly the six pages", () => {
    for (const page of PAGES) {
      expect(footer).toContain(`href: "/${page.slug}"`);
    }
    expect(footer).not.toContain('href: "/faq"');
    expect(footer).toContain('aria-label="Information links"');
  });

  it("uses a three-column grid once Information joined", () => {
    expect(footer).toContain("sm:grid-cols-3");
  });
});
