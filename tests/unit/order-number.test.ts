import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { generateOrderNumber, isOrderNumberCollision } from "@/modules/checkout/order-number";

function p2002(target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`orderNumber`)", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("generateOrderNumber", () => {
  it("matches GIR- + 12 uppercase hex characters", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOrderNumber()).toMatch(/^GIR-[0-9A-F]{12}$/);
    }
  });

  it("does not repeat across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(generateOrderNumber());
    expect(seen.size).toBe(20_000);
  });
});

describe("isOrderNumberCollision", () => {
  it("is true for an orderNumber unique-constraint violation", () => {
    expect(isOrderNumberCollision(p2002(["orderNumber"]))).toBe(true);
    expect(isOrderNumberCollision(p2002("Order_orderNumber_key"))).toBe(true);
  });

  it("is false for unique violations on other fields", () => {
    expect(isOrderNumberCollision(p2002(["email"]))).toBe(false);
    expect(isOrderNumberCollision(p2002(["User_email_key"]))).toBe(false);
  });

  it("is false for other Prisma known errors", () => {
    const notFound = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(isOrderNumberCollision(notFound)).toBe(false);
  });

  it("is false for plain errors and non-errors", () => {
    expect(isOrderNumberCollision(new Error("boom"))).toBe(false);
    expect(isOrderNumberCollision(undefined)).toBe(false);
    expect(isOrderNumberCollision({ code: "P2002" })).toBe(false);
  });
});
