import { Prisma } from "@prisma/client";

// Prisma maps FK violations on INSERT/UPDATE to P2003/P2014, but on DELETE
// against a RESTRICT constraint it surfaces PrismaClientUnknownRequestError
// whose cause is Postgres SQLSTATE 23001 ("violates RESTRICT setting of
// foreign key constraint"). Both shapes mean "rows still reference this row"
// and must be reported to admins as a friendly error, not a 500.

function errorChain(error: unknown): string[] {
  const chain: string[] = [];
  let cursor: unknown = error;
  for (let depth = 0; depth < 6 && cursor; depth += 1) {
    if (cursor instanceof Error) {
      chain.push(`${cursor.name} ${cursor.message}`);
    } else {
      chain.push(String(cursor));
    }
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return chain;
}

export function isForeignKeyRestriction(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Typed Prisma codes are definitive — never scan the message: Prisma
    // embeds the source around the failing call in KnownRequestError
    // messages, so a comment mentioning "23001" above the call would
    // otherwise misclassify a record-not-found as an FK violation. The HTTP
    // driver (Cloudflare Workers) reports DELETE…RESTRICT with the raw
    // SQLSTATE as `code`, which is handled explicitly below.
    if (error.code === "P2003" || error.code === "P2014" || error.code === "23001") {
      return true;
    }
    return false;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return false;
  }
  // Unknown driver errors (the Node WebSocket driver's DELETE…RESTRICT
  // shape carries Postgres 23001) carry the raw database message only.
  return errorChain(error).some(
    (text) =>
      text.includes("23001") ||
      text.includes("foreign key constraint") ||
      text.includes("RESTRICT setting")
  );
}

export function isRecordNotFound(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2025";
  }
  // Same reasoning as isForeignKeyRestriction: a validation error embeds the
  // source around the call in its message — a nearby "P2025" comment must
  // never classify it as a missing record.
  if (error instanceof Prisma.PrismaClientValidationError) {
    return false;
  }
  return errorChain(error).some((text) => text.includes("P2025"));
}
