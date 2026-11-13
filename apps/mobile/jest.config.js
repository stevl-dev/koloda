const { transformIgnorePatterns } = require("jest-expo/jest-preset");

// WHY: Metro bundles ESM-only packages as they are, but Jest runs CommonJS, so the ESM-only packages the shared
// libs import must go through Babel too.
const esmOnly = ["uuid", "marked"];

module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  transformIgnorePatterns: [
    transformIgnorePatterns[0].replace("(?!(", `(?!(${esmOnly.join("|")}|`),
    ...transformIgnorePatterns.slice(1),
  ],
};
