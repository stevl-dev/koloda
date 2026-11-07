import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  cacheDir: resolve(__dirname, "../node_modules/.vite/tools"),
  test: {
    environment: "node",
    include: ["tools/**/*.test.ts"],
  },
});
