import { resolveTestDatabaseUrl } from "./test-db";

// Runs in each vitest worker BEFORE any test file imports src/ modules.
// Must set DATABASE_URL here so @/lib/db constructs its Prisma client
// against the TEST database — never the dev/prod one.
process.env.DATABASE_URL = resolveTestDatabaseUrl();

// next-auth initializes lazily but complains without a secret in some paths.
if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = "test-secret-not-for-production";
}

export {};
