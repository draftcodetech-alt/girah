import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireAdmin } from "@/lib/require-admin";
import { resetDb, createTestUser } from "../setup/helpers";

// Phase 4 L4: requireAdmin must navigate instead of throwing a bare Error
// (which surfaced as a 500 error-boundary page). Anonymous -> /login,
// signed-in-but-not-eligible -> /, mirroring src/proxy.ts.

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

/** Catches the NEXT_REDIRECT throw and returns its payload for assertion. */
async function captureRedirect(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    const e = error as Error & { digest?: string };
    return `${e.message} ${e.digest ?? ""}`;
  }
}

describe("requireAdmin redirects", () => {
  beforeEach(async () => {
    await resetDb();
    authMock.mockReset();
  });

  it("redirects an anonymous caller to /login", async () => {
    authMock.mockResolvedValue(null);
    const blob = await captureRedirect(requireAdmin());
    expect(blob).not.toBeNull();
    expect(blob).toContain("/login");
  });

  it("redirects a session whose account no longer exists to /", async () => {
    authMock.mockResolvedValue({ user: { id: "ghost-user", role: "ADMIN" } });
    const blob = await captureRedirect(requireAdmin());
    expect(blob).toContain("/");
    expect(blob).not.toContain("/login");
  });

  it("redirects a DISABLED admin to /", async () => {
    const admin = await createTestUser({ email: "disabled-admin@girah.test", role: "ADMIN", isActive: false });
    authMock.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });
    const blob = await captureRedirect(requireAdmin());
    expect(blob).toContain("/");
    expect(blob).not.toContain("/login");
  });

  it("redirects a signed-in CUSTOMER to /", async () => {
    const customer = await createTestUser({ email: "customer-admin@girah.test" });
    authMock.mockResolvedValue({ user: { id: customer.id, role: "CUSTOMER" } });
    const blob = await captureRedirect(requireAdmin());
    expect(blob).toContain("/");
    expect(blob).not.toContain("/login");
  });

  it("returns the session for an active admin", async () => {
    const admin = await createTestUser({ email: "active-admin@girah.test", role: "ADMIN" });
    const session = { user: { id: admin.id, role: "ADMIN" } };
    authMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toEqual(session);
  });
});
