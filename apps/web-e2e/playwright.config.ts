import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = 4300;
const isCI = !!process.env.CI;
const viteConfig = "apps/web/vite.config.ts";
const serverArgs = `--host 127.0.0.1 --port ${port} --strictPort`;

export default defineConfig({
  testDir: "./src",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "list",
  outputDir: "../../dist/apps/web-e2e/test-results",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    // WHY: the deploy publishes a production bundle, so CI tests one. StrictMode's double effects and other dev-only
    // paths hid a production-only bug (`decks-audit` D1). The build keeps base `/`: specs `goto("/")` and build
    // `${origin}/ai…` URLs, so the Pages base path stays untested. It runs Vite directly, not `nx build`: Nx would
    // cache this output and could replay it for the deploy's own build.
    command: isCI
      ? `bunx vite build --config ${viteConfig} && bunx vite preview --config ${viteConfig} ${serverArgs}`
      : `bunx vite --config ${viteConfig} ${serverArgs}`,
    cwd: resolve(__dirname, "../.."),
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
