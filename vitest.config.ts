import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB = "postgresql://postgres:postgres@localhost:5432/nexus_test?schema=public";

export default defineConfig({
  // Match Next.js: React's automatic JSX runtime (no `import React` needed in .tsx files).
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws outside Next's server bundle; it's a no-op guard in tests.
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    // next-auth imports "next/server" without an extension, which only Next's bundler resolves;
    // let Vite transform it so the import resolves in tests too.
    server: { deps: { inline: ["next-auth"] } },
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      // Always a dedicated test database, never the real one.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? TEST_DB,
      DIRECT_URL: process.env.TEST_DATABASE_URL ?? TEST_DB,
      AUTH_SECRET: "test-secret-not-used-in-production-0000000000",
      NEXT_PUBLIC_APP_URL: "https://nexus.test",
    },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
