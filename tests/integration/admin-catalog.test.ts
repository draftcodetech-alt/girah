import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  uploadProductImage,
  deleteProductImage,
  moveProductImage,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminCategoriesWithCounts,
  createVariation,
  updateVariation,
  deleteProduct,
} from "@/modules/admin";
import { uploadImageCore, deleteImageCore, moveImageCore } from "@/modules/admin/image-ops";
import { resetDb, createTestProduct } from "../setup/helpers";

// Phase 11: admin catalog completeness — image upload gating (Cloudinary is
// mocked so CI needs no credentials), category CRUD with in-use refusals,
// variation create with rupees→paisa conversion, and deleteProduct (first
// automated coverage of the action that previously had no UI caller).

const cloudinary = vi.hoisted(() => {
  const uploadStream = vi.fn(
    (
      _options: unknown,
      callback: (error: Error | null, result?: { secure_url: string }) => void
    ) => ({
      end: () =>
        callback(null, {
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1700000000/girah/test.jpg",
        }),
    })
  );
  const destroy = vi.fn(async () => ({ result: "ok" }));
  const config = vi.fn();
  return { uploadStream, destroy, config };
});

vi.mock("cloudinary", () => ({
  v2: { config: cloudinary.config, uploader: { upload_stream: cloudinary.uploadStream, destroy: cloudinary.destroy } },
}));

const requireAdminMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/require-admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function imageFile(type = "image/jpeg", bytes = 1024) {
  return new File([new Uint8Array(bytes)], "photo.jpg", { type });
}

function firstUploadUrl() {
  const calls = cloudinary.uploadStream.mock.calls;
  return calls.length;
}

describe("uploadImageCore", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    cloudinary.uploadStream.mockClear();
    cloudinary.destroy.mockClear();
    cloudinary.config.mockClear();
  });

  it("stores the returned URL as sortOrder 0 for a fresh product", async () => {
    const { product } = await createTestProduct();
    const result = await uploadImageCore(product.id, imageFile());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.productId).toBe(product.id);
      expect(result.slug).toBe(product.slug);
    }
    const rows = await db.productImage.findMany({ where: { productId: product.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toContain("res.cloudinary.com");
    expect(rows[0].sortOrder).toBe(0);
    expect(cloudinary.config).toHaveBeenCalled();
  });

  it("appends sortOrder after the current maximum", async () => {
    const { product } = await createTestProduct();
    await uploadImageCore(product.id, imageFile());
    await uploadImageCore(product.id, imageFile());
    const rows = await db.productImage.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
  });

  it("refuses a non-image file before any upload", async () => {
    const { product } = await createTestProduct();
    const result = await uploadImageCore(product.id, imageFile("text/plain"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/JPEG, PNG, WebP, AVIF or GIF/i);
    expect(firstUploadUrl()).toBe(0);
    expect(await db.productImage.count()).toBe(0);
  });

  it("refuses an oversize file before any upload", async () => {
    const { product } = await createTestProduct();
    const big = new File([new Uint8Array(4 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    const result = await uploadImageCore(product.id, big);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/3\.5 MB/i);
    expect(firstUploadUrl()).toBe(0);
  });

  it("refuses a missing file and an unknown product", async () => {
    const { product } = await createTestProduct();
    expect((await uploadImageCore(product.id, null)).success).toBe(false);
    const unknown = await uploadImageCore("no-such-product", imageFile());
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.error).toMatch(/not found/i);
    expect(firstUploadUrl()).toBe(0);
  });

  it("enforces the 10-image cap", async () => {
    const { product } = await createTestProduct();
    await db.productImage.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        productId: product.id,
        url: `https://res.cloudinary.com/demo/image/upload/v1/girah/x${index}.jpg`,
        sortOrder: index,
      })),
    });
    const result = await uploadImageCore(product.id, imageFile());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/at most 10 images/i);
    expect(firstUploadUrl()).toBe(0);
    expect(await db.productImage.count()).toBe(10);
  });

  it("returns a friendly error (and stores nothing) when the upload fails", async () => {
    const { product } = await createTestProduct();
    cloudinary.uploadStream.mockImplementationOnce((_options, callback) => ({
      end: () => callback(new Error("network down")),
    }));
    const result = await uploadImageCore(product.id, imageFile());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Upload failed/i);
    expect(await db.productImage.count()).toBe(0);
  });
});

describe("deleteImageCore / moveImageCore", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    cloudinary.uploadStream.mockClear();
    cloudinary.destroy.mockClear();
    cloudinary.config.mockClear();
  });

  async function seedImages(productId: string, count: number) {
    const rows = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        db.productImage.create({
          data: {
            productId,
            url: `https://res.cloudinary.com/demo/image/upload/v1700000000/girah/img${index}.jpg`,
            sortOrder: index,
          },
        })
      )
    );
    return rows;
  }

  it("deletes the row and best-effort destroys the remote asset", async () => {
    const { product } = await createTestProduct();
    const [image] = await seedImages(product.id, 1);

    const result = await deleteImageCore(image.id);
    expect(result.success).toBe(true);
    expect(await db.productImage.findUnique({ where: { id: image.id } })).toBeNull();
    expect(cloudinary.destroy).toHaveBeenCalledWith("girah/img0", { resource_type: "image" });
  });

  it("still succeeds when remote destroy fails", async () => {
    const { product } = await createTestProduct();
    const [image] = await seedImages(product.id, 1);
    cloudinary.destroy.mockRejectedValueOnce(new Error("no credentials"));

    const result = await deleteImageCore(image.id);
    expect(result.success).toBe(true);
    expect(await db.productImage.findUnique({ where: { id: image.id } })).toBeNull();
  });

  it("refuses an unknown image id", async () => {
    const result = await deleteImageCore("nope");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });

  it("move first pins the image at sortOrder 0 and shifts the rest", async () => {
    const { product } = await createTestProduct();
    const images = await seedImages(product.id, 3);

    const result = await moveImageCore(images[2].id, "first");
    expect(result.success).toBe(true);
    const rows = await db.productImage.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(rows.map((row) => row.id)).toEqual([images[2].id, images[0].id, images[1].id]);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });

  it("move last appends the image and keeps a gapless order", async () => {
    const { product } = await createTestProduct();
    const images = await seedImages(product.id, 3);

    const result = await moveImageCore(images[0].id, "last");
    expect(result.success).toBe(true);
    const rows = await db.productImage.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(rows.map((row) => row.id)).toEqual([images[1].id, images[2].id, images[0].id]);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("image server actions", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    cloudinary.uploadStream.mockClear();
    cloudinary.destroy.mockClear();
    cloudinary.config.mockClear();
  });

  it("uploadProductImage reads productId + file from FormData", async () => {
    const { product } = await createTestProduct();
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("file", imageFile());

    const result = await uploadProductImage(formData);
    expect(result.success).toBe(true);
    expect(await db.productImage.count({ where: { productId: product.id } })).toBe(1);
  });

  it("all three actions refuse when requireAdmin rejects", async () => {
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const formData = new FormData();
    formData.set("productId", "any");

    await expect(uploadProductImage(formData)).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(deleteProductImage("any")).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(moveProductImage("any", "first")).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("category CRUD", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("creates a category and returns its id", async () => {
    const result = await createCategory({ name: "Keychains", slug: "keychains" });
    expect(result.success).toBe(true);
    if (result.success && result.id) {
      const row = await db.category.findUnique({ where: { id: result.id } });
      expect(row).toMatchObject({ name: "Keychains", slug: "keychains" });
    }
  });

  it("refuses a duplicate slug with a field error", async () => {
    await createCategory({ name: "Bouquets", slug: "bouquets" });
    const dup = await createCategory({ name: "Also Bouquets", slug: "bouquets" });
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.fieldErrors?.slug).toMatch(/already taken/i);
    expect(await db.category.count({ where: { slug: "bouquets" } })).toBe(1);
  });

  it("validates name and slug shape before touching the DB", async () => {
    const bad = await createCategory({ name: "", slug: "Not Valid!" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.fieldErrors?.name).toBeTruthy();
      expect(bad.fieldErrors?.slug).toMatch(/lowercase/i);
    }
    expect(await db.category.count()).toBe(0);
  });

  it("updateCategory allows keeping its own slug but not stealing another", async () => {
    const a = await createCategory({ name: "A", slug: "cat-a" });
    const b = await createCategory({ name: "B", slug: "cat-b" });
    const bId = b.success && b.id ? b.id : "";
    const aId = a.success && a.id ? a.id : "";

    const keep = await updateCategory(bId, { name: "Bee", slug: "cat-b" });
    expect(keep.success).toBe(true);

    const steal = await updateCategory(bId, { name: "A", slug: "cat-a" });
    expect(steal.success).toBe(false);
    if (!steal.success) expect(steal.fieldErrors?.slug).toMatch(/already taken/i);
    expect((await db.category.findUnique({ where: { id: aId } }))?.slug).toBe("cat-a");
  });

  it("refuses to delete a category that still has products", async () => {
    const { category, product } = await createTestProduct();
    const result = await deleteCategory(category.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/still use this category/i);
    expect(await db.category.findUnique({ where: { id: category.id } })).not.toBeNull();
    expect(await db.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it("deletes an empty category and reports unknown ids", async () => {
    const created = await createCategory({ name: "Temp", slug: "temp" });
    const id = created.success && created.id ? created.id : "";
    expect((await deleteCategory(id)).success).toBe(true);
    expect(await db.category.findUnique({ where: { id } })).toBeNull();

    const missing = await deleteCategory("nope");
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error).toMatch(/not found/i);
  });

  it("lists categories with product counts for the admin page", async () => {
    await createTestProduct();
    await createCategory({ name: "Empty", slug: "empty" });
    const rows = await getAdminCategoriesWithCounts();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const withProduct = rows.find((row) => row._count.products > 0);
    expect(withProduct?._count.products).toBe(1);
  });

  it("gates every category entry point behind requireAdmin", async () => {
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(getAdminCategoriesWithCounts()).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(createCategory({ name: "X", slug: "x" })).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(deleteCategory("any")).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("variation create + edit", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("creates a variation converting rupees to integer paisa", async () => {
    const { product } = await createTestProduct();
    const result = await createVariation({
      productId: product.id,
      name: "Large Bouquet",
      price: 1800.5, // rupees → 180050 paisa
      stock: 7,
      isEnabled: true,
    });
    expect(result.success).toBe(true);

    const row = await db.productVariation.findFirst({ where: { name: "Large Bouquet" } });
    expect(row).toMatchObject({ productId: product.id, price: 180050, stock: 7, isEnabled: true });
  });

  it("validates price, stock and productId", async () => {
    const { product } = await createTestProduct();
    const noStock = await createVariation({
      productId: product.id,
      name: "Bad",
      price: 10,
      stock: -1,
      isEnabled: true,
    });
    expect(noStock.success).toBe(false);
    if (!noStock.success) expect(noStock.fieldErrors?.stock).toBeTruthy();

    const noPrice = await createVariation({
      productId: product.id,
      name: "Bad",
      price: 0,
      stock: 1,
      isEnabled: true,
    });
    expect(noPrice.success).toBe(false);
    if (!noPrice.success) expect(noPrice.fieldErrors?.price).toBeTruthy();

    const unknown = await createVariation({
      productId: "nope",
      name: "Bad",
      price: 10,
      stock: 1,
      isEnabled: true,
    });
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.error).toMatch(/not found/i);
    expect(await db.productVariation.count({ where: { name: "Bad" } })).toBe(0);
  });

  it("updateVariation edits name/price (paisa contract unchanged)", async () => {
    const { variation } = await createTestProduct();
    const result = await updateVariation(variation.id, {
      name: "Renamed",
      price: 99_900,
      isEnabled: false,
    });
    expect(result.success).toBe(true);
    const row = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(row).toMatchObject({ name: "Renamed", price: 99_900, isEnabled: false });
  });
});

describe("deleteProduct (first automated coverage)", () => {
  beforeEach(async () => {
    await resetDb();
    requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("refuses a product referenced by an order and keeps it intact", async () => {
    const { product, variation } = await createTestProduct();
    await db.order.create({
      data: {
        orderNumber: `GIR-P11${Date.now()}`,
        customerName: "Ref",
        customerEmail: "ref@girah.test",
        customerPhone: "03001112223",
        shippingAddress: "Street 1",
        shippingCity: "Lahore",
        subtotal: 1000,
        total: 1000,
        paymentMethod: "COD",
        items: {
          create: {
            variationId: variation.id,
            productName: product.name,
            variationName: variation.name,
            unitPrice: 1000,
            quantity: 1,
            subtotal: 1000,
          },
        },
      },
    });

    const result = await deleteProduct(product.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/orders or carts/i);
    expect(await db.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it("deletes an unreferenced product (variations and images cascade)", async () => {
    const { product } = await createTestProduct();
    await db.productImage.create({
      data: {
        productId: product.id,
        url: "https://res.cloudinary.com/demo/image/upload/v1/girah/gone.jpg",
      },
    });

    const result = await deleteProduct(product.id);
    expect(result.success).toBe(true);
    expect(await db.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(await db.productVariation.count({ where: { productId: product.id } })).toBe(0);
    expect(await db.productImage.count({ where: { productId: product.id } })).toBe(0);
  });

  it("reports unknown product ids", async () => {
    const result = await deleteProduct("nope");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });
});
