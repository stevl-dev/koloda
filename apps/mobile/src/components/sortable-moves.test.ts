import { dropIndex, rowShift } from "./sortable-moves";

// Three rows 40 tall with a gap of 10: middles at 20, 70, and 120.
const ROWS = [
  { y: 0, height: 40 },
  { y: 50, height: 40 },
  { y: 100, height: 40 },
];

describe("dropIndex", () => {
  it.each([
    ["stays put without moving", 0, 0, 0],
    ["stays put until its middle passes the next row's", 0, 49, 0],
    ["takes the next row's place once its middle passes it", 0, 51, 1],
    ["drops last when dragged past the end", 0, 500, 2],
    ["moves up once its middle passes the row above", 2, -51, 1],
    ["drops first when dragged past the start", 2, -500, 0],
    ["stays put just short of the row above", 1, -49, 1],
  ])("%s", (_case, from, offset, expected) => {
    expect(dropIndex(ROWS, from, offset)).toBe(expected);
  });

  it("keeps a row whose layout is not measured yet where it is", () => {
    expect(dropIndex([], 1, 200)).toBe(1);
  });
});

describe("rowShift", () => {
  it("moves the rows between a downward drag's start and drop up by one slot", () => {
    expect([0, 1, 2, 3].map((index) => rowShift(index, 0, 2, 50))).toEqual([0, -50, -50, 0]);
  });

  it("moves the rows between an upward drag's drop and start down by one slot", () => {
    expect([0, 1, 2, 3].map((index) => rowShift(index, 3, 1, 50))).toEqual([0, 50, 50, 0]);
  });

  it("moves nothing while the lifted row hovers where it started", () => {
    expect([0, 1, 2].map((index) => rowShift(index, 1, 1, 50))).toEqual([0, 0, 0]);
  });
});
