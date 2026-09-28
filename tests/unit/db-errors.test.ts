import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { isForeignKeyRestriction, isRecordNotFound } from "@/modules/admin/db-errors";

// Phase 17: the HTTP driver (Cloudflare) and the WebSocket driver report the
// same database conditions with DIFFERENT error shapes — P2003/P2014 vs raw
// SQLSTATE "23001" vs UnknownRequestError — and PrismaClientKnownRequestError
// messages embed the source around the failing call, which once made a P2025
// (record not found) match the FK message check when a nearby comment
// mentioned "23001". These tests pin every classification.

function known(code: string, message = "boom"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "test",
  });
}

describe("isForeignKeyRestriction — typed driver shapes", () => {
  it("accepts P2003 (FK violation on insert/update)", () => {
    expect(isForeignKeyRestriction(known("P2003"))).toBe(true);
  });

  it("accepts P2014 (required relation violation)", () => {
    expect(isForeignKeyRestriction(known("P2014"))).toBe(true);
  });

  it("accepts the HTTP driver's raw SQLSTATE code 23001", () => {
    expect(
      isForeignKeyRestriction(
        known(
          "23001",
          'update or delete on table "ProductVariation" violates RESTRICT setting of foreign key constraint'
        )
      )
    ).toBe(true);
  });

  it("REJECTS P2025 even when the embedded source text contains FK keywords (regression)", () => {
    // Prisma embeds lines around the failing call — including this very
    // comment shape: (Postgres 23001) … foreign key constraint … RESTRICT.
    const polluted = known(
      "P2025",
      "Invalid `db.product.delete()` invocation:\n" +
        "// DELETE…RESTRICT arrives as an UNKNOWN Prisma error\n" +
        "// (Postgres 23001), so isForeignKeyRestriction checks both shapes.\n" +
        "An operation failed because it depends on one or more records that were required but not found."
    );
    expect(isForeignKeyRestriction(polluted)).toBe(false);
    expect(isRecordNotFound(polluted)).toBe(true);
  });

  it("rejects other typed codes (unique violation etc.)", () => {
    expect(isForeignKeyRestriction(known("P2002", "Unique constraint failed"))).toBe(false);
    expect(isForeignKeyRestriction(known("P2025"))).toBe(false);
  });
});

describe("isForeignKeyRestriction — validation errors", () => {
  it("never classifies a validation error as an FK violation", () => {
    const validation = new Prisma.PrismaClientValidationError(
      "Argument `id`: (Postgres 23001) violates RESTRICT setting of foreign key constraint",
      { clientVersion: "test" }
    );
    expect(isForeignKeyRestriction(validation)).toBe(false);
    // ...and likewise not as record-not-found, even with P2025 in the text.
    const validationNotFound = new Prisma.PrismaClientValidationError(
      "Argument `id`: code P2025 missing record",
      { clientVersion: "test" }
    );
    expect(isRecordNotFound(validationNotFound)).toBe(false);
  });
});

describe("isForeignKeyRestriction — unknown driver shapes (WebSocket DELETE…RESTRICT)", () => {
  it("matches the raw RESTRICT message", () => {
    const error = new Error(
      'update or delete on table "ProductVariation" violates RESTRICT setting of foreign key constraint "OrderItem_variationId_fkey" on table "OrderItem"'
    );
    expect(isForeignKeyRestriction(error)).toBe(true);
  });

  it("matches a bare SQLSTATE anywhere in the cause chain", () => {
    const cause = new Error("23001 foreign_key_violation");
    const error = new Error("delete failed", { cause });
    expect(isForeignKeyRestriction(error)).toBe(true);
  });

  it("stays false for unrelated errors", () => {
    expect(isForeignKeyRestriction(new Error("connection reset"))).toBe(false);
    expect(isForeignKeyRestriction("kaboom")).toBe(false);
    expect(isForeignKeyRestriction(null)).toBe(false);
  });
});

describe("isRecordNotFound", () => {
  it("accepts P2025 on the known-request shape", () => {
    expect(isRecordNotFound(known("P2025"))).toBe(true);
  });

  it("rejects FK codes", () => {
    expect(isRecordNotFound(known("P2003"))).toBe(false);
    expect(isRecordNotFound(known("23001"))).toBe(false);
  });

  it("matches P2025 in an unknown error's chain", () => {
    expect(isRecordNotFound(new Error("P2025: record not found"))).toBe(true);
  });
});
