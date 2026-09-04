import { describe, expect, it } from "vitest";
import { formatOpeningHours } from "./format-opening-hours";

describe("formatOpeningHours", () => {
  it("reads a window the way the sign on the door does", () => {
    expect(formatOpeningHours([{ opensAt: 420, closesAt: 960 }])).toBe(
      "Open 7:00 am to 4:00 pm",
    );
  });

  it("says both halves of a day that closes in the middle", () => {
    expect(
      formatOpeningHours([
        { opensAt: 540, closesAt: 720 },
        { opensAt: 900, closesAt: 1290 },
      ]),
    ).toBe("Open 9:00 am to 12:00 pm, 3:00 pm to 9:30 pm");
  });

  it("carries a window that runs past midnight round the clock", () => {
    expect(formatOpeningHours([{ opensAt: 1140, closesAt: 1560 }])).toBe(
      "Open 7:00 pm to 2:00 am",
    );
  });

  it("says so when the place is shut all day", () => {
    expect(formatOpeningHours([])).toBe("Closed today");
  });

  it("says nothing when the hours are not known", () => {
    expect(formatOpeningHours(null)).toBeNull();
  });
});
