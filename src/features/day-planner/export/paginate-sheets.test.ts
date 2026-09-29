import { describe, expect, it } from "vitest";
import { paginate } from "./paginate-sheets";

describe("paginate", () => {
  it("keeps a day that fits on one sheet", () => {
    expect(paginate([100, 100, 100], 400, 900)).toEqual([[0, 1, 2]]);
  });

  it("deals rows onto the next sheet once the first is full", () => {
    expect(paginate([300, 300, 300, 300], 700, 700)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("gives later sheets their own room, which is more than the first has", () => {
    expect(paginate([200, 200, 200, 200, 200], 300, 800)).toEqual([[0], [1, 2, 3, 4]]);
  });

  it("fills a sheet exactly to its room", () => {
    expect(paginate([250, 250, 100], 500, 500)).toEqual([
      [0, 1],
      [2],
    ]);
  });

  it("puts a row taller than a sheet on a sheet of its own rather than cutting it", () => {
    expect(paginate([100, 2000, 100], 500, 500)).toEqual([[0], [1], [2]]);
  });

  it("leaves the first sheet to its opening when even the first row does not fit under it", () => {
    expect(paginate([300, 100], 200, 800)).toEqual([[], [0, 1]]);
  });

  it("still keeps a row too tall for any sheet on the first, rather than a blank sheet before it", () => {
    expect(paginate([2000], 200, 800)).toEqual([[0]]);
  });

  it("makes one empty sheet of a day with no rows", () => {
    expect(paginate([], 500, 500)).toEqual([[]]);
  });
});
