import type { LinguiConfig } from "@lingui/conf";
import rootConfig from "../../lingui.config";

const { catalogs, ...baseConfig } = rootConfig;

// WHY: the app ships English only until it gets a second locale.
const config: LinguiConfig = {
  ...baseConfig,
  locales: ["en"],
  catalogs: [
    ...(catalogs || []),
    {
      path: "./locales/{locale}/messages",
      include: ["./src"],
    },
  ],
  // WHY: Expo Router treats every file under `src/app` as a route, so the compiled catalogs live outside it.
  catalogsMergePath: "src/locales/{locale}",
};

export default config;
