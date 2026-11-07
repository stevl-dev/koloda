import { describe, expect, it } from "vitest";
import { formatNumber } from "./number-format";

describe("formatNumber", () => {
  it.each([
    { locale: "en", value: 1234.5, digits: 0, expected: "1,235" },
    { locale: "ru", value: 1234.5, digits: 0, expected: "1 235" },
    { locale: "en", value: 3.1, digits: 2, expected: "3.10" },
    { locale: "ru", value: 3.1, digits: 2, expected: "3,10" },
    { locale: "ru", value: 0.12345, digits: 4, expected: "0,1235" },
    { locale: "ru", value: 42.25, digits: 1, expected: "42,3" },
  ])("writes $value with $digits fraction digits as $expected in $locale", ({ locale, value, digits, expected }) => {
    expect(formatNumber(value, digits, locale)).toBe(expected);
  });
});
