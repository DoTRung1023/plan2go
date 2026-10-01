import { describe, expect, it } from "vitest";
import { exportFileName, tidyFileName } from "./export-name";

const trip = { title: "Hanoi in five days", cityName: "Hanoi", available: 5, coverOnly: false };

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

  it("says the cover alone, whichever days were chosen before it", () => {
    expect(exportFileName({ ...trip, dayNumbers: [2, 3], coverOnly: true })).toBe(
      "Hanoi in five days - Cover",
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

describe("tidyFileName", () => {
  it("turns what a file system objects to into spaces, and closes them up", () => {
    expect(tidyFileName("Hue/Hoi An: Day 1")).toBe("Hue Hoi An Day 1");
  });

  it("drops characters that draw nothing", () => {
    expect(tidyFileName("Hanoi\u200b trip\u00ad")).toBe("Hanoi trip");
  });

  it("drops a .pdf typed on the end, since the file is given one", () => {
    expect(tidyFileName("Rome.PDF")).toBe("Rome");
  });

  it("leaves nothing of a name made only of what it removes", () => {
    expect(tidyFileName("/// ?\u200b")).toBe("");
  });

  it("keeps Vietnamese as it is written", () => {
    expect(tidyFileName("  Hà Nội   và Huế ")).toBe("Hà Nội và Huế");
  });
});
