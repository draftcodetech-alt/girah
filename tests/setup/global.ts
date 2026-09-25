import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { resolveTestDatabaseUrl } from "./test-db";

config({ path: `${process.cwd()}/.env` });
neonConfig.webSocketConstructor = ws;

async function ensureTestDatabase() {
  const testUrl = resolveTestDatabaseUrl();
  const url = new URL(testUrl);

  // Explicit DATABASE_URL_TEST is managed by whoever provides it.
  if (process.env.DATABASE_URL_TEST) return testUrl;

  // Derived girah_test: create it on the main database if missing.
  const mainUrl = process.env.DATABASE_URL;
  if (!mainUrl) throw new Error("DATABASE_URL is not set.");
  const main = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: mainUrl }),
  });
  try {
    await main.$executeRawUnsafe(`CREATE DATABASE "${url.pathname.slice(1)}"`);
    console.log(`[test-setup] created database ${url.pathname.slice(1)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  } finally {
    await main.$disconnect();
  }
  return testUrl;
}

function migrate(testUrl: string) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed for the test database (exit ${result.status})`);
  }
}

export default async function globalSetup() {
  const testUrl = await ensureTestDatabase();
  migrate(testUrl);
  console.log(`[test-setup] test database ready: ${new URL(testUrl).pathname}`);
}
