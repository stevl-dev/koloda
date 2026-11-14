import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  cacheDir: resolve(__dirname, "../../node_modules/.vite/libs/assistant-react"),
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@lingui/core/macro": resolve(__dirname, "../../tools/test/mocks/lingui-core-macro.ts"),
    },
  },
  test: {
    pool: "threads",
    // WHY: These files share a worker module registry to skip per-file isolation cost.
    // A file-level vi.mock leaks to every later file on the worker; mock a module a sibling imports for real in
    // src/test-setup.ts, not in a test file.
    isolate: false,
    maxWorkers: 2,
    environment: "jsdom",
    include: ["libs/assistant-react/src/**/*.test.ts", "libs/assistant-react/src/**/*.test.tsx"],
    setupFiles: [resolve(__dirname, "src/test-setup.ts")],
  },
});
