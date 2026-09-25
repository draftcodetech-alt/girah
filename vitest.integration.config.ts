import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests share ONE database (girah_test) — serialize files so
// TRUNCATE in one file can't clobber another file's fixtures mid-run.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    globalSetup: ["tests/setup/global.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    // next-auth imports extensionless subpaths (next/server) that Node's
    // native ESM loader can't resolve — process it through Vite instead.
    // Needed since Phase 4: orders/actions.ts now imports @/lib/auth.
    server: {
      deps: {
        inline: ["next-auth", "@auth/core"],
      },
    },
  },
});
