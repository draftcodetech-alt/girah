#!/usr/bin/env node
// Generates .dev.vars (gitignored) from .env so `opennextjs-cloudflare preview`
// can inject runtime secrets into the local worker — workerd has no filesystem
// and cannot load .env itself. Runs on `prepreview`. Fails loudly.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (!existsSync(envPath)) {
  console.error("[sync-dev-vars] FATAL: .env not found — preview needs DATABASE_URL, AUTH_SECRET, …");
  process.exit(1);
}

const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
const entries = [];
for (const raw of lines) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq <= 0) continue;
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim();
  if (!value) continue;
  if (key === "NEXTJS_ENV" || key === "AUTH_URL") continue; // set explicitly below
  entries.push(`${key}=${value}`);
}

const required = ["DATABASE_URL", "AUTH_SECRET"];
const present = new Set(entries.map((e) => e.slice(0, e.indexOf("="))));
const missing = required.filter((k) => !present.has(k));
if (missing.length) {
  console.error(`[sync-dev-vars] FATAL: .env is missing required keys: ${missing.join(", ")}`);
  process.exit(1);
}

const out = [
  "# AUTO-GENERATED from .env by scripts/sync-dev-vars.mjs — do not edit.",
  "NEXTJS_ENV=development",
  // Pin the local origin: Auth.js derives secure-cookie mode from AUTH_URL,
  // and locally the middleware (x-forwarded-proto default https) and the
  // server (http request URL) would otherwise DISAGREE on the session
  // cookie name — middleware looks for __Secure-authjs.session-token while
  // login writes authjs.session-token, so every authed route 307s.
  "AUTH_URL=http://localhost:8787",
  ...entries,
];
writeFileSync(join(root, ".dev.vars"), out.join("\n") + "\n");
console.log(`[sync-dev-vars] wrote .dev.vars (${entries.length} vars from .env)`);
