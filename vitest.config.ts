import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    environment: "node",
    testTimeout: 15000,
    // next-auth imports extensionless subpaths (next/server) that Node's
    // native ESM loader can't resolve — process it through Vite instead.
    server: {
      deps: {
        inline: ["next-auth", "@auth/core"],
      },
    },
  },
});
