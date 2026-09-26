import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { saveShippingAddress, deleteShippingAddress } from "@/modules/addresses/actions";
import { getMyShippingAddress } from "@/modules/addresses/queries";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 12: one saved shipping address per user (upsert), delete-safe, and
// the prefill query the checkout page and /account/addresses share.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ADDRESS = {
  fullName: "Ayesha Khan",
  phone: "03001234567",
  address: "House 12, Street 4, DHA",
  city: "Lahore",
  postalCode: "54000",
};

describe("saved shipping address", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("refuses to save without a session", async () => {
    authMock.mockResolvedValue(null);

    const result = await saveShippingAddress(ADDRESS);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("You must be signed in.");
  });

  it("returns field errors instead of writing an invalid address", async () => {
    const user = await createTestUser();
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    const result = await saveShippingAddress({ ...ADDRESS, city: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.city).toBe("City is required");
      expect(result.error).toBe("Please check the highlighted fields.");
    }
    expect(await db.savedShipping.count()).toBe(0);
  });

  it("creates on first save and UPDATES on the second (single row per user)", async () => {
    const user = await createTestUser({ email: "addr1@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });

    expect((await saveShippingAddress(ADDRESS)).success).toBe(true);
    expect(await db.savedShipping.count()).toBe(1);

    expect((await saveShippingAddress({ ...ADDRESS, city: "Karachi" })).success).toBe(true);
    expect(await db.savedShipping.count()).toBe(1);

    const saved = await getMyShippingAddress();
    expect(saved).toMatchObject({ city: "Karachi", fullName: "Ayesha Khan" });
  });

  it("keeps two users' addresses independent", async () => {
    const alice = await createTestUser({ email: "alice-addr@girah.test" });
    const bob = await createTestUser({ email: "bob-addr@girah.test" });

    authMock.mockResolvedValue({ user: { id: alice.id, role: "CUSTOMER" } });
    await saveShippingAddress(ADDRESS);
    authMock.mockResolvedValue({ user: { id: bob.id, role: "CUSTOMER" } });
    await saveShippingAddress({ ...ADDRESS, city: "Peshawar" });

    expect(await db.savedShipping.count()).toBe(2);
    expect((await getMyShippingAddress())?.city).toBe("Peshawar");
  });

  it("deletes for the signed-in user, and a second delete is still a success", async () => {
    const user = await createTestUser({ email: "addr-del@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    await saveShippingAddress(ADDRESS);
    expect(await db.savedShipping.count()).toBe(1);

    expect((await deleteShippingAddress()).success).toBe(true);
    expect(await db.savedShipping.count()).toBe(0);
    expect((await deleteShippingAddress()).success).toBe(true);
  });

  it("refuses delete without a session", async () => {
    authMock.mockResolvedValue(null);
    const result = await deleteShippingAddress();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("You must be signed in.");
  });

  it("prefill query: null for guests and for users who never saved", async () => {
    authMock.mockResolvedValue(null);
    expect(await getMyShippingAddress()).toBeNull();

    const user = await createTestUser({ email: "addr-none@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    expect(await getMyShippingAddress()).toBeNull();
  });

  it("stores an empty postal code as NULL, not a blank string", async () => {
    const user = await createTestUser({ email: "addr-postal@girah.test" });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CUSTOMER" } });
    await saveShippingAddress({ ...ADDRESS, postalCode: "" });

    expect((await getMyShippingAddress())?.postalCode).toBeNull();
  });
});
