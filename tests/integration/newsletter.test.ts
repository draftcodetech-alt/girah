import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  subscribeNewsletter,
  getNewsletterSubscribers,
  deleteNewsletterSubscriber,
} from "@/modules/newsletter";
import { resetDb } from "../setup/helpers";

// Newsletter persistence: subscribe is idempotent (unique index collapses
// resubmits), validation rejects junk before any DB write, and the admin
// list/delete pair is requireAdmin-gated like every other admin read.
vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-session-id", role: "ADMIN" } })),
}));

beforeEach(async () => {
  await resetDb();
});

describe("subscribeNewsletter", () => {
  it("stores a trimmed, lowercased address", async () => {
    const result = await subscribeNewsletter("  Reader@Example.COM  ");
    expect(result).toEqual({ success: true, alreadySubscribed: false });
    const rows = await db.newsletterSubscriber.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("reader@example.com");
  });

  it("reports resubmits honestly without duplicating", async () => {
    expect(await subscribeNewsletter("loop@girah.test")).toEqual({
      success: true,
      alreadySubscribed: false,
    });
    expect(await subscribeNewsletter("LOOP@girah.test")).toEqual({
      success: true,
      alreadySubscribed: true,
    });
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });

  it("rejects junk without touching the table", async () => {
    for (const bad of ["not-an-email", "a@b", "", "   "]) {
      const result = await subscribeNewsletter(bad);
      expect(result.success).toBe(false);
    }
    expect(await db.newsletterSubscriber.count()).toBe(0);
  });
});

describe("admin list/delete", () => {
  it("lists newest-first and deletes by id", async () => {
    await subscribeNewsletter("first@girah.test");
    await subscribeNewsletter("second@girah.test");

    const rows = await getNewsletterSubscribers();
    expect(rows.map((r) => r.email)).toEqual(["second@girah.test", "first@girah.test"]);

    expect(await deleteNewsletterSubscriber(rows[0].id)).toEqual({ success: true });
    expect(await db.newsletterSubscriber.count()).toBe(1);
    expect(await deleteNewsletterSubscriber("newsletter-that-never-existed")).toEqual({
      success: false,
    });
  });
});
