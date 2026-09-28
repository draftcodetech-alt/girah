import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import ws from "ws";

// Cloudflare Workers ship a native WebSocket constructor and cannot run the
// Node `ws` implementation; everywhere else (Node dev/server/CI) Neon needs it.
const onCloudflareWorkers =
  typeof navigator !== "undefined" &&
  (navigator.userAgent ?? "").includes("Cloudflare-Workers");

if (!onCloudflareWorkers) {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;

/**
 * On Cloudflare Workers a pooled WebSocket client is a foot-gun: the pool
 * is created inside whichever request happens to initialize the module, and
 * when a pooled connection's promise resolves after that request finished,
 * workerd cancels it ("promise resolved from a different request context"
 * → hung request → 500; prisma/prisma#28732, payloadcms/payload#17335).
 * The compatibility flag only changes the failure mode.
 *
 * Workerd therefore uses the HTTP driver for everything — each query is a
 * stateless fetch that always runs inside the current request's context —
 * with two escape hatches, because PrismaNeonHTTP refuses any operation it
 * has to execute inside a transaction ("Transactions are not supported in
 * HTTP mode", thrown LOCALLY before any statement runs):
 *
 *  1. `db.$transaction(fn)` (interactive) runs on a throwaway WebSocket
 *     client created and disposed within the same request, so no pool ever
 *     outlives it.
 *  2. Single model operations that Prisma compiles to more than one
 *     statement (`upsert`, write + `include`/relation-`select`, `createMany`,
 *     nested writes …) first run on the HTTP client; if it refuses with that
 *     exact error, the same operation re-runs once on a throwaway WebSocket
 *     client. The refusal happens before any SQL executes, so the retry
 *     cannot double-apply a partial write.
 *
 * The batch form `db.$transaction([…])` cannot work here: its array of
 * PrismaPromises is already bound to the HTTP client, so it is rejected
 * with a guidance error — call sites must use the interactive form.
 *
 * Node (vitest, e2e, next start) has no request-context isolation, so it
 * keeps the pooled WebSocket client: one connection, no per-tx handshake.
 */
function createClient(): PrismaClient {
  if (!onCloudflareWorkers) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }
  return new PrismaClient({
    adapter: new PrismaNeonHTTP(connectionString!, {}),
  });
}

function createTransactionClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

const HTTP_TX_UNSUPPORTED = "Transactions are not supported in HTTP mode";

function isHttpTxUnsupported(error: unknown): boolean {
  return error instanceof Error && error.message.includes(HTTP_TX_UNSUPPORTED);
}

type AnyDelegate = Record<string, unknown>;

function isModelDelegate(value: unknown): value is AnyDelegate {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AnyDelegate).findMany === "function"
  );
}

/** Model methods wrapped with the HTTP→throwaway-WebSocket retry (see above). */
function withTxFallback(modelKey: string, delegate: AnyDelegate): AnyDelegate {
  return new Proxy(delegate, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== "function" || typeof prop !== "string") {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args);
        return Promise.resolve(result).catch((error: unknown) => {
          if (!isHttpTxUnsupported(error)) throw error;
          const txClient = createTransactionClient();
          const model = (txClient as unknown as Record<string, AnyDelegate>)[modelKey];
          const retry = model[prop] as (...a: unknown[]) => unknown;
          return Promise.resolve(retry.apply(model, args)).finally(() =>
            txClient.$disconnect().catch(() => {}),
          );
        });
      };
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = base;
}

function withRequestScopedTransactions(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "$transaction") {
        return (...args: unknown[]) => {
          if (Array.isArray(args[0])) {
            return Promise.reject(
              new Error(
                "db.$transaction([…]) (batch form) cannot run on Cloudflare Workers: " +
                  "its PrismaPromises are bound to the HTTP client. Convert the call " +
                  "site to the interactive form db.$transaction(async (tx) => { … }).",
              ),
            );
          }
          const txClient = createTransactionClient();
          const result = (
            txClient.$transaction as (...a: unknown[]) => Promise<unknown>
          )(...args);
          return Promise.resolve(result).finally(() =>
            txClient.$disconnect().catch(() => {}),
          );
        };
      }
      const value = Reflect.get(target, prop);
      if (isModelDelegate(value)) {
        return withTxFallback(String(prop), value);
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const db = onCloudflareWorkers ? withRequestScopedTransactions(base) : base;
