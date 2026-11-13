import { fromWire, toWire, WireError } from "./wire";

describe("koloda-mobile wire", () => {
  it("serializes dates to epoch ms for IPC", () => {
    const ms = 1_700_000_001_000;
    expect(toWire({ updatedAt: new Date(ms) })).toEqual({ updatedAt: ms });
  });

  it("rehydrates ISO date strings from IPC responses", () => {
    const iso = "2023-11-14T22:13:21.000Z";
    const result = fromWire<{ updatedAt: Date }>({ updatedAt: iso });
    expect(result.updatedAt).toEqual(new Date(iso));
  });

  it("does not revive ISO strings inside opaque conversation state", () => {
    const iso = "2026-07-18T11:00:00.000Z";
    const result = fromWire<{
      createdAt: Date;
      state: { messages: Array<{ metadata: { createdAt: string; runId: string } }> };
    }>({
      createdAt: iso,
      state: {
        messages: [{ metadata: { createdAt: iso, runId: "r1" } }],
      },
    });

    expect(result.createdAt).toEqual(new Date(iso));
    expect(result.state.messages[0].metadata.createdAt).toBe(iso);
    expect(typeof result.state.messages[0].metadata.createdAt).toBe("string");
  });

  it("rehydrates timestamp fields nested in arrays and objects", () => {
    const iso = "2026-01-02T03:04:05.000Z";
    const result = fromWire<{
      cards: Array<{ id: string; dueAt: Date; lastReviewedAt: Date | null }>;
      content: { profiles: Array<{ id: string; createdAt: Date }> };
    }>({
      cards: [{ id: "c1", dueAt: iso, lastReviewedAt: null }],
      content: { profiles: [{ id: "p1", createdAt: iso }] },
    });

    expect(result.cards[0].dueAt).toEqual(new Date(iso));
    expect(result.content.profiles[0].createdAt).toEqual(new Date(iso));
  });

  it("keeps date-shaped strings that are not timestamp fields", () => {
    // A deck titled "2024-01-01" and a card field holding "2026-01-01" must
    // survive the wire as strings.
    const result = fromWire<{ title: string; content: Record<string, string> }>({
      title: "2024-01-01",
      content: { "01900000-0000-7000-8000-000000000001": "2026-01-01" },
    });

    expect(result.title).toBe("2024-01-01");
    expect(result.content["01900000-0000-7000-8000-000000000001"]).toBe("2026-01-01");
  });

  it("keeps non-ISO strings under timestamp field names", () => {
    const result = fromWire<{ dueAt: string }>({ dueAt: "not-a-date" });
    expect(result.dueAt).toBe("not-a-date");
  });

  it("writes dates inside opaque conversation state as ISO strings", () => {
    const iso = "2026-10-30T09:00:00.000Z";
    const wire = toWire({
      state: { createdAt: new Date(iso), runs: { r1: { startedAt: new Date(iso) } } },
      updatedAt: new Date(iso),
    });
    expect(wire).toEqual({
      state: { createdAt: iso, runs: { r1: { startedAt: iso } } },
      updatedAt: new Date(iso).getTime(),
    });
  });

  const circular: Record<string, unknown> = { a: 1 };
  circular.self = circular;

  it.each([
    ["a function", () => {}],
    ["a function in a nested object", { fn() {} }],
    ["a circular reference", circular],
    ["an Invalid Date", { dueAt: new Date(Number.NaN) }],
    ["a BigInt one past MAX_SAFE_INTEGER", BigInt(Number.MAX_SAFE_INTEGER) + 1n],
    ["a BigInt one past MIN_SAFE_INTEGER", BigInt(Number.MIN_SAFE_INTEGER) - 1n],
  ])("throws WireError for %s", (_name, value) => {
    expect(() => toWire(value)).toThrow(WireError);
  });

  it.each([
    ["MAX_SAFE_INTEGER", BigInt(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    ["MIN_SAFE_INTEGER", BigInt(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER],
  ])("serializes a BigInt at %s as a number", (_name, value, expected) => {
    expect(toWire({ count: value })).toEqual({ count: expected });
  });

  it("drops undefined values from objects", () => {
    expect(toWire({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("preserves null values in objects", () => {
    expect(toWire({ a: 1, b: null })).toEqual({ a: 1, b: null });
  });
});
