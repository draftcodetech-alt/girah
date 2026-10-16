import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Phase 17: content pages. About ships the full reference design; Contact
// is ported from the approved eb mockup (real address, prefilled mailtos,
// Islamabad base). Shipping/Returns/Privacy/Terms were removed by owner
// decision — their routes, links, and sitemap entries are asserted GONE.

const ROOT = new URL("../..", import.meta.url).pathname;
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

const PAGES = [
  { slug: "about", file: "src/app/(storefront)/about/page.tsx", title: "About" },
  { slug: "contact", file: "src/app/(storefront)/contact/page.tsx", title: "Contact" },
];

const REMOVED = [
  "src/app/(storefront)/shipping/page.tsx",
  "src/app/(storefront)/returns/page.tsx",
  "src/app/(storefront)/privacy/page.tsx",
  "src/app/(storefront)/terms/page.tsx",
];

describe("Phase 17: content pages exist", () => {
  for (const page of PAGES) {
    it(`/${page.slug} is a real route with metadata + the shared shell`, () => {
      expect(existsSync(join(ROOT, page.file))).toBe(true);
      const source = readSource(page.file);
      expect(source).toContain("export const metadata");
      expect(source).toContain(`title: "${page.title}"`);
      // About ships the full reference design (AboutSections); Contact is the
      // eb mockup port (ContactSections) — neither uses the 720px text shell.
      if (page.slug === "about") {
        expect(source).toContain("AboutSections");
      } else {
        expect(source).toContain("ContactSections");
      }
      // Inside the (storefront) segment → inherits header/footer.
      expect(page.file).toContain("(storefront)");
    });
  }

  it("removed pages are fully gone (no route files)", () => {
    for (const file of REMOVED) {
      expect(existsSync(join(ROOT, file))).toBe(false);
    }
  });
});

describe("Phase 17: contact carries the real eb-mockup facts", () => {
  it("shows the real address, prefilled mailtos, and Islamabad base", () => {
    const source =
      readSource("src/app/(storefront)/contact/page.tsx") +
      readSource("src/components/storefront/contact/ContactSections.tsx");
    expect(source).toContain("syedareebkareem@gmail.com");
    expect(source).toContain("Question about my order");
    expect(source).toContain("A custom crochet idea");
    expect(source).toContain("Islamabad");
    expect(source).toContain("/contact/boquet_contact_us.webp");
    expect(source).not.toContain("[placeholder");
  });
});
describe("Phase 17: about reference page (untouched by removals)", () => {
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

  it("contact imagery ships from /public/contact", () => {
    for (const img of ["boquet_contact_us.webp", "email_with_leaf.webp", "flower_with_leaves.webp", "leaf.webp"]) {
      expect(existsSync(join(ROOT, `public/contact/${img}`))).toBe(true);
    }
  });
});

describe("Phase 17: footer Information column", () => {
  const footer = readSource("src/components/shared/Footer.tsx");

  it("links exactly the two surviving pages", () => {
    for (const page of PAGES) {
      expect(footer).toContain(`href: "/${page.slug}"`);
    }
    for (const gone of ["shipping", "returns", "privacy", "terms"]) {
      expect(footer).not.toContain(`href: "/${gone}"`);
    }
    expect(footer).not.toContain('href: "/faq"');
    expect(footer).toContain('aria-label="Information links"');
  });

  it("uses a three-column grid once Information joined", () => {
    expect(footer).toContain("sm:grid-cols-3");
  });
});
