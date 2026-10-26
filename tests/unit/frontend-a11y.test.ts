import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Frontend a11y pins for the fe-complete pass: every fix here was
// DOM-verified against the dev server (eval + screenshots) before pinning,
// so these guards only prevent silent regressions.
const ROOT = process.cwd();
const readSource = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("skip-link targets", () => {
  it("every layout exposes #main-content", () => {
    for (const layout of [
      "src/app/(storefront)/layout.tsx",
      "src/app/(auth)/layout.tsx",
      "src/app/account/layout.tsx",
      "src/app/admin/layout.tsx",
    ]) {
      expect(readSource(layout)).toContain('id="main-content"');
    }
  });
});

describe("filter controls are named", () => {
  it("FilterPanel min/max and SortSelect carry aria-labels", () => {
    const panel = readSource("src/components/storefront/FilterPanel.tsx");
    expect(panel).toContain('aria-label="Minimum price in rupees"');
    expect(panel).toContain('aria-label="Maximum price in rupees"');
    expect(readSource("src/components/storefront/SortSelect.tsx")).toContain(
      'aria-label="Sort products"'
    );
  });

  it("shop drawer trigger/panel/close are wired", () => {
    const source = readSource("src/components/storefront/ShopFilters.tsx");
    expect(source).toContain("aria-expanded={drawerOpen}");
    expect(source).toContain('aria-controls="shop-filters-panel"');
    expect(source).toContain('id="shop-filters-panel"');
    expect(source).toContain('aria-label="Close filters"');
  });

  it("category tabs expose the active tab", () => {
    expect(readSource("src/components/storefront/CategoryTabs.tsx")).toContain('aria-current');
  });

  it("instagram tiles name their links", () => {
    expect(readSource("src/components/storefront/home/InstagramShowcase.tsx")).toContain(
      "aria-label={`Girah on Instagram"
    );
  });
});

describe("heading order", () => {
  it("no h1->h3 skip in purchase panel, cart, admin variation, footer", () => {
    const panel = readSource("src/components/storefront/PurchasePanel.tsx");
    expect(panel).not.toMatch(/<h3[^>]*>\s*Variation/);
    expect(panel).not.toMatch(/<h3[^>]*>\s*Quantity/);
    expect(readSource("src/app/(storefront)/cart/page.tsx")).not.toMatch(
      /<h3 className="font-body text-card-title/
    );
    expect(readSource("src/app/admin/products/[id]/page.tsx")).not.toContain(
      "Add variation\n          </h3>"
    );
    const footer = readSource("src/components/shared/Footer.tsx");
    expect(footer).not.toMatch(/<h4>/);
    expect(footer).toContain("<h2>Shop</h2>");
  });
});

describe("label association", () => {
  it("every storefront form control has htmlFor + id", () => {
    const pairs: [string, string[]][] = [
      ["src/components/storefront/CheckoutForm.tsx", ["fullName", "phone", "email", "address", "city", "postalCode", "deliveryNotes"]],
      ["src/components/storefront/AddressForm.tsx", ["fullName", "phone", "address", "city", "postalCode"]],
      ["src/components/storefront/ProfileForm.tsx", ["name", "email", "phone", "currentPassword", "newPassword", "confirmNewPassword"]],
      ["src/components/storefront/RegisterForm.tsx", ["name", "email", "password", "confirmPassword"]],
      ["src/components/storefront/LoginForm.tsx", ["email"]],
      ["src/components/storefront/ResetPasswordForm.tsx", ["password", "confirmPassword"]],
      ["src/components/storefront/ForgotPasswordForm.tsx", ["email"]],
    ];
    for (const [file, fields] of pairs) {
      const source = readSource(file);
      for (const field of fields) {
        expect(source).toContain(`htmlFor="${field}"`);
        expect(source).toContain(`id="${field}"`);
        expect(source).toContain(`name="${field}"`);
      }
    }
  });

  it("login password label is associated across its sibling link", () => {
    const source = readSource("src/components/storefront/LoginForm.tsx");
    expect(source).toContain('htmlFor="login-password"');
    expect(source).toContain('id="login-password"');
  });

  it("repeating admin forms prefix ids per row", () => {
    expect(readSource("src/components/admin/CategoryForm.tsx")).toContain("idPrefix");
    expect(readSource("src/components/admin/VariationForm.tsx")).toContain("idPrefix");
    // The per-row ids that used to live here belonged to the stock-adjust
    // form; that form (and the stock concept) is gone by spec.
    expect(readSource("src/components/admin/VariationRow.tsx")).not.toContain("adjust-${variation.id}");
  });
});

describe("shop result state (real query data)", () => {
  it("count + removable filter chips render from live params", () => {
    const source = readSource("src/app/(storefront)/shop/page.tsx");
    expect(source).toContain("pieces");
    expect(source).toContain("Remove filter");
    expect(source).toContain('aria-live="polite"');
  });
});

describe("buy-path helpers (real data)", () => {
  it("PDP keeps its failure announcement and shows no stock copy", () => {
    const source = readSource("src/components/storefront/PurchasePanel.tsx");
    expect(source).toContain('role="alert"');
    // Stock hint ("In stock" / "Only N left in stock") removed by spec.
    expect(source).not.toContain("left in stock");
    expect(source).not.toContain("Only ${selected.stock}");
  });

  it("checkout summary shows real thumbnails", () => {
    const source = readSource("src/components/storefront/CheckoutForm.tsx");
    expect(source).toContain("item.imageUrl");
    expect(source).toContain('width={48}');
  });

  it("empty cart suggests live catalog products", () => {
    const source = readSource("src/app/(storefront)/cart/page.tsx");
    expect(source).toContain("You may also like");
    expect(source).toContain("getProducts({ sort: \"featured\" })");
  });

  it("admin image alts name the product", () => {
    expect(readSource("src/components/admin/ImageManager.tsx")).toContain(
      "${productName} — image ${index + 1}"
    );
  });
});

describe("newsletter persistence (real table, honest states)", () => {
  it("module exposes subscribe/list/delete with idempotent contract", () => {
    const index = readSource("src/modules/newsletter/index.ts");
    expect(index).toContain("subscribeNewsletter");
    expect(index).toContain("getNewsletterSubscribers");
    const actions = readSource("src/modules/newsletter/actions.ts");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("alreadySubscribed");
    expect(actions).toContain('code === "P2002"');
    expect(actions).toContain("requireAdmin");
    // Welcome mail fires through the never-throws transport, so a mail
    // failure can never fail the signup itself.
    expect(actions).toContain("sendEmailSafe(newsletterWelcomeEmail({ to: email }))");
  });

  it("footer form persists (no fake success) and admin page exists", () => {
    const form = readSource("src/components/shared/FooterNewsletter.tsx");
    expect(form).toContain("subscribeNewsletter");
    expect(form).toContain("already in the loop");
    expect(readSource("src/app/admin/newsletter/page.tsx")).toContain("getNewsletterSubscribers");
    expect(readSource("src/app/admin/layout.tsx")).toContain('"/admin/newsletter"');
  });

  it("migration creates the table deploy-consistently", () => {
    const sql = readSource("prisma/migrations/20261012000000_phase19_newsletter/migration.sql");
    expect(sql).toContain('CREATE TABLE "NewsletterSubscriber"');
    expect(sql).toContain("NewsletterSubscriber_email_key");
    expect(readSource("prisma/schema.prisma")).toContain("model NewsletterSubscriber");
  });
});

describe("approved adds (real data only)", () => {
  it("announcement bar states live store facts", () => {
    const bar = readSource("src/components/shared/AnnouncementBar.tsx");
    expect(bar).toContain("Free shipping on all orders");
    expect(bar).toContain("Cash on delivery available");
    expect(readSource("src/app/(storefront)/layout.tsx")).toContain("AnnouncementBar");
  });

  it("back-to-top respects reduced motion and names itself", () => {
    const source = readSource("src/components/shared/BackToTop.tsx");
    expect(source).toContain('aria-label="Back to top"');
    expect(source).toContain("prefers-reduced-motion");
  });

  it("confirmation timeline is status-driven with a cancelled branch", () => {
    const source = readSource("src/components/storefront/OrderTimeline.tsx");
    expect(source).toContain('aria-label="Order progress"');
    expect(source).toContain('aria-current={current ? "step" : undefined}');
    expect(source).toContain("CANCELLED");
    expect(readSource("src/app/(storefront)/order/[id]/confirmation/page.tsx")).toContain(
      "OrderTimeline"
    );
  });

  it("instagram uses the real profile URL and real photos", () => {
    expect(readSource("src/components/storefront/home/InstagramShowcase.tsx")).toContain(
      "NEXT_PUBLIC_INSTAGRAM_URL"
    );
  });
});
describe("overlay dialog behavior (shared hook)", () => {
  it("menu, cart drawer, and filter sheet share useDialog", () => {
    const hook = readSource("src/components/shared/use-dialog.ts");
    expect(hook).toContain('"Escape"');
    expect(hook).toContain('overflow = "hidden"');
    expect(hook).toContain("querySelectorAll");
    for (const user of [
      "src/components/shared/MobileMenu.tsx",
      "src/components/storefront/MiniCartDrawer.tsx",
      "src/components/storefront/ShopFilters.tsx",
    ]) {
      expect(readSource(user)).toContain("useDialog(");
    }
  });

  it("filter sheet panel is focusable and labelled", () => {
    const source = readSource("src/components/storefront/ShopFilters.tsx");
    expect(source).toContain('id="shop-filters-panel"');
    expect(source).toContain("tabIndex={-1}");
    expect(source).toContain('role="dialog"');
  });
});

describe("card LCP wiring", () => {
  it("first card in each grid carries priority", () => {
    for (const page of [
      "src/app/(storefront)/shop/page.tsx",
      "src/app/(storefront)/search/page.tsx",
      "src/app/(storefront)/wishlist/page.tsx",
    ]) {
      expect(readSource(page)).toContain("priority={i === 0}");
    }
    expect(readSource("src/components/storefront/home/CollectionSections.tsx")).toContain(
      "priorityFirst"
    );
  });

  it("font bundles carry no unused weights", () => {
    const layout = readSource("src/app/layout.tsx");
    expect(layout).toContain('weight: ["500", "600"]'); // newsreader: no 400
    expect(layout).toContain('weight: ["300", "400", "500", "700"]'); // cormorant: no 600
    expect(layout).toContain('weight: ["300", "400"]'); // jost: no 500
  });
});
