import { db } from "@/lib/db";

/**
 * Wipes every table between tests. FK-safe via CASCADE; runs against the
 * TEST database only (see tests/setup/env.ts).
 */
export async function resetDb(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "CartItem", "Cart",
      "OrderItem", "Order",
      "StockAdjustment",
      "Review",
      "SavedShipping",
      "ProductImage", "ProductVariation", "Product", "Category",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function createTestUser(overrides: Partial<{
  email: string;
  name: string;
  role: "CUSTOMER" | "ADMIN";
  isActive: boolean;
  passwordHash: string;
}> = {}) {
  return db.user.create({
    data: {
      email: overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@girah.test`,
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "CUSTOMER",
      isActive: overrides.isActive ?? true,
      passwordHash: overrides.passwordHash ?? "test-hash",
    },
  });
}

export async function createTestProduct() {
  const category = await db.category.create({
    data: { name: `Cat ${Date.now()}`, slug: `cat-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });
  const product = await db.product.create({
    data: {
      name: `Product ${Date.now()}`,
      slug: `product-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: "Test product",
      categoryId: category.id,
    },
  });
  const variation = await db.productVariation.create({
    data: { productId: product.id, name: "Test Variation", price: 100_000, stock: 5 },
  });
  return { category, product, variation };
}
