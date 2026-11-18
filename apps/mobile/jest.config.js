const { transformIgnorePatterns } = require("jest-expo/jest-preset");

// WHY: Metro bundles ESM-only packages as they are, but Jest runs CommonJS, so the ESM-only packages the shared
// libs import must go through Babel too.
const esmOnly = ["uuid", "marked", "immer"];

module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  // WHY: CI runs these suites beside the Rust checks, and a file's first test pays for transforming and rendering
  // React Native cold; that has passed Jest's default 5 s on a busy runner while taking about 1 s locally.
  testTimeout: 15_000,
  transformIgnorePatterns: [
    transformIgnorePatterns[0].replace("(?!(", `(?!(${esmOnly.join("|")}|`),
    ...transformIgnorePatterns.slice(1),
  ],
};
