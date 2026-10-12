import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import {
  getAdminCustomers,
  getAdminCustomerById,
  updateVariation,
  getAdminOrders,
} from "@/modules/admin";
import { resetDb, createTestProduct, createTestUser } from "../setup/helpers";

// Phase 1 integration: the admin wrappers against the real DB. Two invariants
// carry most of the weight here — passwordHash is never in a response (it is
// excluded by select, not by stripping), and every list/detail read is scoped
// so an admin session can only ever see what the query intends (role filter
// for customers, status filter for orders).

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-session-id", role: "ADMIN" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let seq = 0;

async function seedOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  seq += 1;
  return db.order.create({
    data: {
      orderNumber: `GIR-P1B${Date.now()}${seq}`,
      customerName: "Phase One B",
      customerEmail: `p1b-${seq}@girah.test`,
      customerPhone: "03001112223",
      shippingAddress: "Street 1B",
      shippingCity: "Islamabad",
      subtotal: 5_000,
      total: 5_000,
      paymentMethod: "COD",
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  vi.mocked(requireAdmin).mockClear();
});

describe("getAdminCustomers", () => {
  it("returns customers only, with order counts and NEVER a passwordHash", async () => {
    const customer = await createTestUser({
      email: "listable@girah.test",
      passwordHash: "super-secret-hash",
    });
    await createTestUser({ email: "other-customer@girah.test" });
    await createTestUser({ email: "admin-operator@girah.test", role: "ADMIN" });
    await seedOrder({ userId: customer.id });

    const rows = await getAdminCustomers();

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email)).not.toContain("admin-operator@girah.test");
    for (const row of rows) {
      expect(row).not.toHaveProperty("passwordHash");
      expect("passwordHash" in row).toBe(false);
      expect(row.isActive).toBe(true);
      expect(typeof row._count.orders).toBe("number");
    }
    expect(rows.find((r) => r.email === "listable@girah.test")?._count.orders).toBe(1);
    // Caller really did store a hash — it just never leaves the query layer.
    expect(
      (await db.user.findUniqueOrThrow({ where: { email: "listable@girah.test" } })).passwordHash
    ).toBe("super-secret-hash");
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("matches the search case-insensitively on name or email, and answers [] otherwise", async () => {
    await createTestUser({ name: "Zara Khan", email: "zara.khan@girah.test" });
    await createTestUser({ name: "Bilal", email: "bilal@girah.test" });

    expect((await getAdminCustomers("KHAN")).map((r) => r.email)).toEqual(["zara.khan@girah.test"]);
    expect((await getAdminCustomers("bilal")).map((r) => r.name)).toEqual(["Bilal"]);
    expect(await getAdminCustomers("no-such-customer")).toEqual([]);
  });
});

describe("getAdminCustomerById", () => {
  it("returns the detail view for a customer without leaking passwordHash", async () => {
    const customer = await createTestUser({ email: "detail@girah.test" });
    const order = await seedOrder({ userId: customer.id });

    const detail = await getAdminCustomerById(customer.id);

    expect(detail).not.toBeNull();
    expect(detail!.customer).not.toHaveProperty("passwordHash");
    expect(detail!.customer).toMatchObject({ id: customer.id, email: "detail@girah.test" });
    expect(detail!.orders.map((o) => o.id)).toEqual([order.id]);
    expect(detail!.orders[0].items).toEqual([]);
    expect(detail!.savedShipping).toBeNull();
  });

  it("is stranger-safe: an admin id, an unknown id and a non-id all come back null", async () => {
    await createTestUser({ email: "operator@girah.test", role: "ADMIN" });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "operator@girah.test" } });

    expect(await getAdminCustomerById(admin.id)).toBeNull(); // role filter
    expect(await getAdminCustomerById("no-such-user-id")).toBeNull();
    expect(await getAdminCustomerById("")).toBeNull();
    expect(requireAdmin).toHaveBeenCalledTimes(3);
  });
});

describe("updateVariation", () => {
  it("persists a price change as integer paisa", async () => {
    const { variation } = await createTestProduct(); // price 100_000

    const result = await updateVariation(variation.id, {
      name: variation.name,
      price: 150_000,
      isEnabled: true,
    });

    expect(result.success).toBe(true);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.price).toBe(150_000);
    expect(Number.isInteger(fresh.price)).toBe(true);
  });

  // There is no toggleVariation export — enable/disable goes through
  // updateVariation's isEnabled flag, which is what the admin UI calls.
  it("flips isEnabled in both directions and leaves price untouched", async () => {
    const { variation } = await createTestProduct();
    expect(variation.isEnabled).toBe(true);

    const disabled = await updateVariation(variation.id, {
      name: variation.name,
      price: variation.price,
      isEnabled: false,
    });
    expect(disabled.success).toBe(true);
    expect(
      (await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).isEnabled
    ).toBe(false);

    const reEnabled = await updateVariation(variation.id, {
      name: variation.name,
      price: variation.price,
      isEnabled: true,
    });
    expect(reEnabled.success).toBe(true);
    const fresh = await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } });
    expect(fresh.isEnabled).toBe(true);
    expect(fresh.price).toBe(variation.price);
  });

  it("refuses a malformed payload with generic field errors and writes nothing", async () => {
    const { variation } = await createTestProduct();

    const result = await updateVariation(variation.id, {
      name: "",
      price: 0,
      isEnabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Please check the highlighted fields.");
      expect(result.fieldErrors?.name).toBeTruthy();
      expect(result.fieldErrors?.price).toBeTruthy();
    }
    expect(
      (await db.productVariation.findUniqueOrThrow({ where: { id: variation.id } })).price
    ).toBe(100_000);
  });
});

describe("getAdminOrders", () => {
  it("respects the status filter and ignores unknown statuses", async () => {
    await seedOrder({ orderStatus: "PENDING" });
    await seedOrder({ orderStatus: "SHIPPED" });
    await seedOrder({ orderStatus: "SHIPPED" });

    const shipped = await getAdminOrders({ status: "SHIPPED" });
    expect(shipped).toHaveLength(2);
    expect(shipped.every((o) => o.orderStatus === "SHIPPED")).toBe(true);

    // A crafted status must not become a "matches nothing" oracle.
    const unknown = await getAdminOrders({ status: "NOT_A_STATUS" });
    expect(unknown).toHaveLength(3);
    expect(await getAdminOrders({ status: "CANCELLED" })).toHaveLength(0);
  });

  it("respects the search filter across number, name and email", async () => {
    const target = await seedOrder({ customerName: "Findable Person" });
    await seedOrder({ customerName: "Someone Else" });

    const byName = await getAdminOrders({ search: "findable" });
    expect(byName.map((o) => o.id)).toEqual([target.id]);

    const byNumber = await getAdminOrders({ search: target.orderNumber });
    expect(byNumber.map((o) => o.id)).toEqual([target.id]);

    expect(await getAdminOrders({ search: "nobody-here" })).toHaveLength(0);
  });

  // getAdminOrders takes { status, search } only — there are NO pagination
  // params on this wrapper (the admin orders page renders the whole filtered
  // set). Asserting the unfiltered result stays complete is the contract that
  // would break if a silent limit/offset were ever introduced.
  it("returns every matching order — the wrapper takes no pagination params", async () => {
    for (let i = 0; i < 15; i++) await seedOrder({ orderStatus: i % 2 ? "PENDING" : "SHIPPED" });

    const all = await getAdminOrders();
    expect(all).toHaveLength(15);
    expect(all.map((o) => o.orderNumber)).toHaveLength(new Set(all.map((o) => o.orderNumber)).size);
    // i % 2 is truthy for i = 1,3,…,13 → 7 PENDING, 8 SHIPPED.
    expect(all.filter((o) => o.orderStatus === "PENDING")).toHaveLength(7);

    // Extra keys are simply ignored by the wrapper — nothing silently pages.
    const withPaginationParams = { status: "PENDING", page: 2, pageSize: 5 };
    expect(await getAdminOrders(withPaginationParams)).toHaveLength(7);
  });

  it("includes line items on every returned order", async () => {
    const { variation } = await createTestProduct();
    const order = await seedOrder();
    await db.orderItem.create({
      data: {
        orderId: order.id,
        variationId: variation.id,
        productName: "Product",
        variationName: "Variation",
        unitPrice: 100_000,
        quantity: 1,
        subtotal: 100_000,
      },
    });

    const [row] = await getAdminOrders();
    expect(row.items).toHaveLength(1);
    expect(row.items[0].quantity).toBe(1);
  });
});
