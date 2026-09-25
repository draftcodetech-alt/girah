import { config } from "dotenv";

// Load project .env once for all test contexts (workers + globalSetup).
config({ path: `${process.cwd()}/.env` });

/**
 * Test database URL resolution:
 * 1. DATABASE_URL_TEST — explicit override (CI secret), used as-is.
 * 2. Otherwise the main DATABASE_URL with the database name swapped to
 *    `girah_test` — same Neon instance, isolated database.
 */
export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL_TEST;
  if (explicit) return explicit;

  const main = process.env.DATABASE_URL;
  if (!main) {
    throw new Error("DATABASE_URL is not set — cannot derive the test database URL.");
  }
  const url = new URL(main);
  url.pathname = "/girah_test";
  return url.toString();
}
