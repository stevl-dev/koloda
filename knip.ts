import type { KnipConfig } from "knip";

// WHY: knip registers its Tailwind CSS compiler only in a workspace that lists `tailwindcss`, and only the root
// does, so the apps' stylesheets were never followed. This reads the same directives, so `@plugin` and `@import`
// count as uses of their packages and files.
const cssDirective = /@(?:import|plugin|config|reference)\s+["']([^"']+)["']/g;

function compileCss(text: string) {
  return [...text.matchAll(cssDirective)]
    .map(([, specifier], index) => `import _$${index} from "${specifier}";`)
    .join("\n");
}

// WHY: Lingui's CLI loads `lingui.config.ts` by path, and each app's `index.html` links `src/styles.css`;
// knip follows neither.
const appEntry = ["lingui.config.ts", "src/styles.css"];

const config: KnipConfig = {
  compilers: { css: compileCss },
  workspaces: {
    ".": {
      // WHY: every vitest config aliases `@lingui/core/macro` to this mock by path.
      entry: ["lingui.config.ts", "tools/test/mocks/*.ts"],
      ignoreDependencies: [
        // WHY: each app's `vite.config.ts` names it as a string in the SWC plugin list.
        "@lingui/swc-plugin",
        // WHY: `apps/electron-e2e` has no package.json, so it falls in this workspace, while `apps/electron` pins
        // the Electron it launches. Listing it here too would let the two versions drift.
        "electron",
      ],
    },
    "apps/*": {
      entry: appEntry,
    },
    "apps/web": {
      // WHY: `i18n.ts` loads compiled catalogs through a template-literal `import()`.
      entry: [...appEntry, "src/app/locales/*.ts"],
    },
    "apps/electron-react": {
      // WHY: `i18n.ts` loads compiled catalogs through a template-literal `import()`.
      entry: [...appEntry, "src/app/locales/*.ts"],
    },
    "apps/mobile": {
      // WHY: Lingui's CLI loads `lingui.config.ts` by path; the app has no stylesheet.
      entry: ["lingui.config.ts"],
    },
    "apps/electron": {
      // WHY: swc compiles it standalone and Electron loads it by path.
      entry: ["src/preload.ts"],
    },
    "libs/settings-react": {
      // WHY: `tools/vite-plugin-theme-boot.ts` serves and copies it by path.
      entry: ["public/theme-boot.js"],
    },
  },
  // WHY: TanStack Router generates it whole, including exported types nothing imports.
  ignore: ["libs/app-react/src/lib/routeTree.gen.ts"],
  // WHY: `"types": ["*"]` in `tsconfig.base.json` includes every `@types` package; it is not a module.
  ignoreUnresolved: [/^\*$/],
};

export default config;
