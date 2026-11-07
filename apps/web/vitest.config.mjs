import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  cacheDir: resolve(__dirname, "../../node_modules/.vite/apps/web-unit"),
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@lingui/core/macro": resolve(__dirname, "../../tools/test/mocks/lingui-core-macro.ts"),
    },
  },
  // WHY: `ai.integration.test.ts` opens a real `@koloda/db-sqlite` database, so this mirrors that package's config.
  assetsInclude: ["**/*.sql"],
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
  test: {
    pool: "threads",
    maxWorkers: 2,
    environment: "node",
    include: ["apps/web/src/**/*.test.ts"],
    setupFiles: [resolve(__dirname, "../../libs/db-sqlite/src/test/setup.ts")],
  },
});
