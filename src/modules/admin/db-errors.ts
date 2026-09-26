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
    return error.code === "P2003" || error.code === "P2014";
  }
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
  return errorChain(error).some((text) => text.includes("P2025"));
}
