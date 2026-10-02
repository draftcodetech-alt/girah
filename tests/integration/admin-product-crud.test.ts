import { describe, it, expect, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createProduct, updateProduct } from "@/modules/admin";
import { resetDb } from "../setup/helpers";

// Coverage gap R2: createProduct/updateProduct (the core admin write path)
// had zero tests — duplicate-slug handling, slug self-exclusion on update,
// the requireAdmin gate, and cache revalidation were all unverified.

const requireAdminMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/require-admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function seedCategory(slug = `crud-cat-${Date.now()}`) {
  return db.category.create({ data: { name: "Crud Category", slug } });
}

function input(categoryId: string, overrides: Record<string, string> = {}) {
  return {
    name: "  Crimson Rose Bouquet  ",
    slug: "crimson-rose-bouquet",
    description: "  Deep red roses, hand-tied.  ",
    categoryId,
    ...overrides,
  };
}

describe("createProduct", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(revalidatePath).mockClear();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("creates a product with trimmed values and revalidates admin + shop", async () => {
    const category = await seedCategory();
    const result = await createProduct(input(category.id));
    expect(result.success).toBe(true);

    const row = await db.product.findUniqueOrThrow({ where: { slug: "crimson-rose-bouquet" } });
    expect(row.name).toBe("Crimson Rose Bouquet");
    expect(row.description).toBe("Deep red roses, hand-tied.");
    expect(row.categoryId).toBe(category.id);

    expect(revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(revalidatePath).toHaveBeenCalledWith("/shop");
  });

  it("refuses a duplicate slug with a field error and inserts nothing", async () => {
    const category = await seedCategory();
    expect((await createProduct(input(category.id))).success).toBe(true);
    vi.mocked(revalidatePath).mockClear();

    const second = await createProduct(
      input(category.id, { name: "Different Name", slug: "crimson-rose-bouquet" })
    );
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.fieldErrors?.slug).toBe("This slug is already in use.");
    }
    const count = await db.product.count({ where: { slug: "crimson-rose-bouquet" } });
    expect(count).toBe(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an invalid slug before touching the database", async () => {
    const category = await seedCategory();
    const result = await createProduct(input(category.id, { slug: "Not A Valid Slug!" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.slug).toMatch(/lowercase letters, numbers, and hyphens/i);
    }
    expect(await db.product.count()).toBe(0);
  });

  it("rejects a missing category before touching the database", async () => {
    const result = await createProduct(input("", { slug: "no-category-product" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.categoryId).toBe("Category is required");
    }
    expect(await db.product.count()).toBe(0);
  });

  it("gates on requireAdmin before validation or insert", async () => {
    const category = await seedCategory();
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(createProduct(input(category.id, { slug: "gate-probe" }))).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(await db.product.count({ where: { slug: "gate-probe" } })).toBe(0);
  });
});

describe("updateProduct", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(revalidatePath).mockClear();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  async function seedProduct(categoryId: string) {
    return db.product.create({
      data: {
        name: "Original Name",
        slug: "original-product",
        description: "Original description",
        categoryId,
      },
    });
  }

  it("updates in place while keeping its own slug (self-exclusion)", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category.id);

    const result = await updateProduct(product.id, input(category.id, { slug: "original-product" }));
    expect(result.success).toBe(true);

    const row = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.name).toBe("Crimson Rose Bouquet");
    expect(row.slug).toBe("original-product");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(revalidatePath).toHaveBeenCalledWith("/product/original-product");
    expect(revalidatePath).toHaveBeenCalledWith("/shop");
  });

  it("refuses a slug owned by ANOTHER product and leaves the row unchanged", async () => {
    const category = await seedCategory();
    const target = await seedProduct(category.id);
    await db.product.create({
      data: {
        name: "Other Product",
        slug: "other-product",
        description: "Other",
        categoryId: category.id,
      },
    });

    const result = await updateProduct(target.id, input(category.id, { slug: "other-product" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.slug).toBe("This slug is already in use.");
    }
    const row = await db.product.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.name).toBe("Original Name");
    expect(row.slug).toBe("original-product");
  });

  it("rejects invalid input and leaves the row unchanged", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category.id);

    const result = await updateProduct(product.id, input(category.id, { slug: "Bad Slug!" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.slug).toMatch(/lowercase letters, numbers, and hyphens/i);
    }
    const row = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.name).toBe("Original Name");
  });

  it("gates on requireAdmin before any write", async () => {
    const category = await seedCategory();
    const product = await seedProduct(category.id);
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      updateProduct(product.id, input(category.id, { name: "Hijacked" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    const row = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.name).toBe("Original Name");
  });
});
