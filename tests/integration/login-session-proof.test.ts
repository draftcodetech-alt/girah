import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { login, register } from "@/modules/accounts/actions";
import { resetDb, createTestUser, createTestProduct } from "../setup/helpers";

// Phase 5 C3: inside the login()/register() server action, `auth()` can't see
// the session signIn() just created — it rebuilds its request from the
// INCOMING headers while the cookie lands in the response jar. The proof now
// comes from replaying that jar through Auth.js's /api/auth/session handler,
// so these tests drive both halves: signIn() writing a cookie into the jar,
// and the session endpoint answering for whatever cookie it was handed.

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  signInLeavesCookie: true,
  respond: (): Response | Promise<Response> => Response.json({}),
  handlerCalls: 0,
  lastCookieHeader: "",
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.jar.has(name) ? { name, value: state.jar.get(name) as string } : undefined,
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      state.jar.set(name, value);
    },
    delete: (name: string) => {
      state.jar.delete(typeof name === "string" ? name : (name as { name: string }).name);
    },
  }),
  headers: async () => new Headers({ host: "localhost:3100", "x-forwarded-proto": "http" }),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(async () => {
    if (state.signInLeavesCookie) state.jar.set("authjs.session-token", "just-signed-in");
  }),
  handlers: {
    GET: vi.fn(async (req: Request) => {
      state.handlerCalls++;
      state.lastCookieHeader = req.headers.get("cookie") ?? "";
      return state.respond();
    }),
  },
}));

const C3_ERROR = "Unable to sign in right now. Please try again.";

async function seedGuestCart(guestId: string) {
  const { variation } = await createTestProduct();
  const cart = await db.cart.create({ data: { guestId } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId: variation.id, quantity: 2 } });
  return cart;
}

beforeEach(async () => {
  await resetDb();
  state.jar.clear();
  state.signInLeavesCookie = true;
  state.respond = () => Response.json({});
  state.handlerCalls = 0;
  state.lastCookieHeader = "";
  vi.clearAllMocks();
});

describe("login session proof (C3)", () => {
  it("replays the jar, proves the session and merges the guest cart", async () => {
    const user = await createTestUser({ email: "proof@example.com" });
    await seedGuestCart("guest-proof");
    state.jar.set("girah_guest_id", "guest-proof");
    state.respond = () => Response.json({ user: { id: user.id, email: user.email } });

    const result = await login({ email: "proof@example.com", password: "password1" });

    expect(result).toEqual({ success: true });
    // The cookie signIn() just wrote is what Auth.js was asked about.
    expect(state.lastCookieHeader).toContain("authjs.session-token=just-signed-in");
    expect(state.lastCookieHeader).toContain("girah_guest_id=guest-proof");

    expect(await db.cart.findFirst({ where: { guestId: "guest-proof" } })).toBeNull();
    const accountCart = await db.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(accountCart?.items).toHaveLength(1);
    expect(state.jar.has("girah_guest_id")).toBe(false); // cleared only after the merge
  });

  it("does not even ask Auth.js when signIn() left no session cookie", async () => {
    state.signInLeavesCookie = false;
    state.respond = () => Response.json({ user: { id: "stale-id", email: "proof@example.com" } });

    const result = await login({ email: "proof@example.com", password: "password1" });

    expect(result).toEqual({ success: false, error: C3_ERROR });
    expect(state.handlerCalls).toBe(0);
  });

  it("fails closed when Auth.js reports no session", async () => {
    const result = await login({ email: "proof@example.com", password: "password1" });

    expect(result).toEqual({ success: false, error: C3_ERROR });
  });

  it("fails closed when Auth.js returns a non-OK response (config error)", async () => {
    state.respond = () => Response.json({ message: "There was a problem with the server." }, { status: 500 });

    const result = await login({ email: "proof@example.com", password: "password1" });

    expect(result).toEqual({ success: false, error: C3_ERROR });
  });

  it("refuses a leftover session that belongs to a different account", async () => {
    const other = await createTestUser({ email: "someone.else@example.com" });
    state.respond = () => Response.json({ user: { id: other.id, email: other.email } });

    const result = await login({ email: "proof@example.com", password: "password1" });

    expect(result).toEqual({ success: false, error: C3_ERROR });
  });
});

describe("register session proof", () => {
  it("merges once the live session is for the account it just created", async () => {
    await seedGuestCart("guest-register");
    state.jar.set("girah_guest_id", "guest-register");
    // Answer with whichever account now holds this email — at the moment
    // Auth.js is asked, register() has already inserted the new row.
    state.respond = async () => {
      const created = await db.user.findFirst({
        where: { email: { equals: "newcomer@example.com", mode: "insensitive" } },
      });
      return Response.json({ user: { id: created?.id ?? "missing", email: created?.email ?? null } });
    };

    const result = await register({
      name: "Newcomer",
      email: "newcomer@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result).toEqual({ success: true });
    const created = await db.user.findUniqueOrThrow({
      where: { email: "newcomer@example.com" },
    });
    expect(await db.cart.findFirst({ where: { guestId: "guest-register" } })).toBeNull();
    expect(await db.cart.findUnique({ where: { userId: created.id } })).not.toBeNull();
    expect(state.jar.has("girah_guest_id")).toBe(false);
  });

  it("keeps the guest cart when auto sign-in left a session for another account", async () => {
    const other = await createTestUser({ email: "leftover@example.com" });
    await seedGuestCart("guest-stale");
    state.jar.set("girah_guest_id", "guest-stale");
    state.jar.set("authjs.session-token", "leftover-session");
    state.signInLeavesCookie = false; // auto sign-in failed silently
    state.respond = () => Response.json({ user: { id: other.id, email: other.email } });

    const result = await register({
      name: "Newcomer",
      email: "newcomer@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    // The account exists either way — but the merge must not run for a
    // session that isn't this account's.
    expect(result).toEqual({ success: true });
    expect(await db.cart.findFirst({ where: { guestId: "guest-stale" } })).not.toBeNull();
    expect(state.jar.has("girah_guest_id")).toBe(true);
  });
});
