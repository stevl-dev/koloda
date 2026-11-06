import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { themeBootPlugin } from "../../tools/vite-plugin-theme-boot.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// WHY: `index.html` sets `<base href>` from this. Without a trailing slash the last segment is a file name,
// so `./theme-boot.js` would resolve one level up (`/koloda` + `./x` is `/x`).
const viteBase = process.env.VITE_BASE || "/";
const base = viteBase.endsWith("/") ? viteBase : `${viteBase}/`;

export default defineConfig(() => ({
  root: __dirname,
  base,
  cacheDir: "../../node_modules/.vite/apps/web",
  server: {
    port: 3000,
    host: "localhost",
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
  preview: {
    port: 3000,
    host: "localhost",
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    themeBootPlugin(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: resolve(__dirname, "../../libs/app-react/src/lib/routes"),
      generatedRouteTree: resolve(__dirname, "../../libs/app-react/src/lib/routeTree.gen.ts"),
    }),
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    tailwindcss(),
    lingui(),
  ],
  build: {
    outDir: "../../dist/apps/web",
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  optimizeDeps: {
    // WHY: `wa-sqlite`'s Emscripten build locates its `.wasm` by `new URL(…, import.meta.url)`; pre-bundling moves the
    // module away from that file. `libs/db-sqlite/vitest.config.mjs` excludes it for the same reason.
    exclude: ["wa-sqlite"],
  },
}));
