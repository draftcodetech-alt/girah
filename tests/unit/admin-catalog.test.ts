import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { isOptimizableImageUrl } from "@/lib/image";

// Phase 11 (admin catalog): source guards for the upload gate ordering, auth
// gates, rupees→paisa conversion, and the pages/components that must exist.

const ROOT = new URL("../..", import.meta.url).pathname;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("isOptimizableImageUrl", () => {
  it("accepts Cloudinary delivery URLs (the only host next/image whitelists)", () => {
    expect(
      isOptimizableImageUrl(
        "https://res.cloudinary.com/demo/image/upload/v1/girah/bouquet.png"
      )
    ).toBe(true);
  });

  it("rejects other hosts, relative and malformed URLs", () => {
    expect(isOptimizableImageUrl("https://evil.example.com/x.png")).toBe(false);
    expect(isOptimizableImageUrl("/uploads/local.png")).toBe(false);
    expect(isOptimizableImageUrl("not a url")).toBe(false);
    expect(isOptimizableImageUrl("")).toBe(false);
  });
});

describe("Phase 11: image upload gate", () => {
  const ops = readSource("src/modules/admin/image-ops.ts");

  it("validates product, count, type and size BEFORE any upload", () => {
    const uploadAt = ops.indexOf("await uploadBuffer("); // the call site, not the definition
    expect(uploadAt).toBeGreaterThan(0);
    expect(ops.indexOf('db.product.findUnique')).toBeLessThan(uploadAt);
    expect(ops.indexOf("db.productImage.count")).toBeLessThan(uploadAt);
    expect(ops.indexOf("ALLOWED_IMAGE_TYPES.includes")).toBeLessThan(uploadAt);
    expect(ops.indexOf("file.size > MAX_IMAGE_BYTES")).toBeLessThan(uploadAt);
  });

  it("only allows image mime types", () => {
    expect(ops).toContain('["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]');
    expect(ops).not.toContain('"application/pdf"');
  });

  it("keeps the app limit under the 4mb server-action body cap", () => {
    expect(ops).toContain("MAX_IMAGE_BYTES = 3.5 * 1024 * 1024");
    const config = readSource("next.config.ts");
    expect(config).toContain('bodySizeLimit: "4mb"');
  });

  it("configures Cloudinary lazily (no import-time credentials)", () => {
    expect(ops).toContain("function ensureCloudinary()");
    // The only cloudinary.config call lives inside the lazy helper.
    const configCalls = ops.match(/cloudinary\.config\(/g) ?? [];
    expect(configCalls).toHaveLength(1);
    const helperAt = ops.indexOf("function ensureCloudinary()");
    const callAt = ops.indexOf("cloudinary.config(");
    expect(callAt).toBeGreaterThan(helperAt);
    expect(ops.indexOf("import { v2 as cloudinary")).toBeLessThan(helperAt);
  });

  it("wraps remote cleanup in best-effort try/catch", () => {
    expect(ops).toContain("cloudinary.uploader.destroy");
    const destroyAt = ops.indexOf("cloudinary.uploader.destroy");
    const block = ops.slice(ops.lastIndexOf("try", destroyAt), ops.indexOf("catch", destroyAt));
    expect(block).toContain("try {");
    expect(ops).toContain("Cloudinary destroy skipped");
  });
});

describe("Phase 11: image actions are admin-gated", () => {
  const images = readSource("src/modules/admin/images.ts");

  it.each(["uploadProductImage", "deleteProductImage", "moveProductImage"])(
    "%s calls requireAdmin before touching the core",
    (actionName) => {
      const start = images.indexOf(`export async function ${actionName}`);
      expect(start).toBeGreaterThan(0);
      const body = images.slice(start, images.indexOf("}", start));
      expect(body).toContain("await requireAdmin()");
    }
  );

  it("revalidates list, edit page, product page and shop", () => {
    expect(images).toContain('revalidatePath("/admin/products")');
    expect(images).toContain("revalidatePath(`/admin/products/${productId}`)");
    expect(images).toContain("revalidatePath(`/product/${slug}`)");
    expect(images).toContain('revalidatePath("/shop")');
  });
});

describe("Phase 11: variation create", () => {
  it("converts rupees to integer paisa with Math.round, server-side", () => {
    const source = readSource("src/modules/admin/variations.ts");
    expect(source).toContain("createVariation");
    expect(source).toContain("Math.round(price * 100)");
    expect(source).toContain("await requireAdmin()");
  });

  it("the create form sends rupees and the edit path paisa", () => {
    const form = readSource("src/components/admin/VariationForm.tsx");
    expect(form).toContain("createVariation");
    expect(form).toContain("Math.round(rupees * 100)");
    expect(form).not.toContain("name=\"stock\" defaultValue={variation"); // stock never editable post-create
  });

  it("mounts create + edit affordances on the product edit page", () => {
    const page = readSource("src/app/admin/products/[id]/page.tsx");
    expect(page).toContain("ImageManager");
    expect(page).toContain("VariationForm productId=");
    expect(page).toContain('aria-labelledby="images-heading"');
    expect(page).toContain('aria-labelledby="variations-heading"');
    expect(readSource("src/components/admin/VariationRow.tsx")).toContain("VariationForm");
  });
});

describe("Phase 11: category CRUD", () => {
  const categories = readSource("src/modules/admin/categories.ts");

  it("gates every category mutation behind requireAdmin", () => {
    const gates = categories.match(/await requireAdmin\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(4);
  });

  it("friendly-refuses an in-use delete and a duplicate slug", () => {
    expect(categories).toContain("P2003");
    expect(categories).toContain("P2014");
    expect(categories).toContain("Products still use this category");
    expect(categories).toContain("P2002");
  });

  it("exposes a /admin/categories page in the admin nav", () => {
    expect(existsSync(join(ROOT, "src/app/admin/categories/page.tsx"))).toBe(true);
    const layout = readSource("src/app/admin/layout.tsx");
    expect(layout).toContain('href: "/admin/categories"');
    expect(readSource("src/app/admin/categories/page.tsx")).toContain("CategoryRow");
  });

  it("ProductForm can create a category inline", () => {
    const form = readSource("src/components/admin/ProductForm.tsx");
    expect(form).toContain("createCategory");
    expect(form).toContain("＋ New category");
    expect(form).toContain("Create the new category first");
  });
});

describe("Phase 11: product list delete + thumbnail", () => {
  const list = readSource("src/app/admin/products/page.tsx");

  it("renders the cover thumbnail and the delete button", () => {
    expect(list).toContain("ProductDeleteButton");
    expect(list).toContain("isOptimizableImageUrl");
    expect(list).toContain("<Image");
  });

  it("delete button confirms twice and surfaces refusals", () => {
    const button = readSource("src/components/admin/ProductDeleteButton.tsx");
    expect(button).toContain("deleteProduct");
    expect(button).toContain('role="alert"');
    expect(button).toContain("Yes, delete");
  });
});
