import { describe, expect, it } from "vitest";
import { exportFileName } from "./export-name";

const trip = { title: "Hanoi in five days", cityName: "Hanoi", available: 5 };

describe("exportFileName", () => {
  it("names one day by its number in the trip", () => {
    expect(exportFileName({ ...trip, dayNumbers: [3] })).toBe("Hanoi in five days - Day 3");
  });

  it("says a run of days as a range", () => {
    expect(exportFileName({ ...trip, dayNumbers: [2, 3, 4] })).toBe(
      "Hanoi in five days - Days 2-4",
    );
  });

  it("lists a scattered few", () => {
    expect(exportFileName({ ...trip, dayNumbers: [1, 4] })).toBe(
      "Hanoi in five days - Days 1, 4",
    );
  });

  it("counts them once there are more than a few", () => {
    expect(exportFileName({ ...trip, dayNumbers: [1, 3, 4, 5] })).toBe(
      "Hanoi in five days - 4 days",
    );
  });

  it("says nothing about days when the whole trip is in the file", () => {
    expect(exportFileName({ ...trip, dayNumbers: [1, 2, 3, 4, 5] })).toBe("Hanoi in five days");
  });

  it("falls back to the city, and then to a word, when the trip has no name", () => {
    expect(exportFileName({ ...trip, title: "  ", dayNumbers: [1] })).toBe("Hanoi - Day 1");
    expect(exportFileName({ ...trip, title: "", cityName: null, dayNumbers: [1] })).toBe(
      "Trip - Day 1",
    );
  });

  it("takes out what a file system would object to", () => {
    expect(exportFileName({ ...trip, title: 'Hue/Hoi An: "the north"', dayNumbers: [1] })).toBe(
      "Hue Hoi An the north - Day 1",
    );
  });

  it("keeps the stacked marks a Vietnamese name depends on", () => {
    expect(exportFileName({ ...trip, title: "Nhà hát Lớn Hà Nội", dayNumbers: [1] })).toBe(
      "Nhà hát Lớn Hà Nội - Day 1",
    );
  });
});
