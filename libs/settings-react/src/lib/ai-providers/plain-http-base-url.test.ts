import { describe, expect, it } from "vitest";
import { isPlainHttpToPublicHost } from "./plain-http-base-url";

describe("isPlainHttpToPublicHost", () => {
  it.each([
    "http://localhost:11434",
    "http://app.localhost/v1",
    "http://127.0.0.1:1234/v1",
    "http://127.1.2.3",
    "http://[::1]:11434",
    "http://10.0.0.5:11434",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.10:11434",
    "http://nas.local:8000/v1",
    "http://[fd00::1]:8000",
    "http://[fe80::1]",
    "http://169.254.1.1",
  ])("does not warn for %s, on this machine or a private network", (baseUrl) => {
    expect(isPlainHttpToPublicHost(baseUrl)).toBe(false);
  });

  it.each([
    "http://172.32.0.1",
    "http://172.15.255.255",
    "http://11.0.0.1",
    "http://8.8.8.8:11434",
    "http://example.com/v1",
    "http://[2001:db8::1]",
    "http://[fd::1]",
  ])("warns for %s, a public host", (baseUrl) => {
    expect(isPlainHttpToPublicHost(baseUrl)).toBe(true);
  });

  it.each(["https://example.com/v1", "https://8.8.8.8", "not-a-url", ""])("does not warn for %j", (baseUrl) => {
    expect(isPlainHttpToPublicHost(baseUrl)).toBe(false);
  });
});
