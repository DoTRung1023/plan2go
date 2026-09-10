import { describe, expect, it } from "vitest";
import { formatOpeningHours } from "./format-opening-hours";

describe("formatOpeningHours", () => {
  it("reads a window the way the sign on the door does", () => {
    expect(formatOpeningHours([{ opensAt: 420, closesAt: 960 }])).toBe(
      "Open 07:00 to 16:00",
    );
  });

  it("says both halves of a day that closes in the middle", () => {
    expect(
      formatOpeningHours([
        { opensAt: 540, closesAt: 720 },
        { opensAt: 900, closesAt: 1290 },
      ]),
    ).toBe("Open 09:00 to 12:00, 15:00 to 21:30");
  });

  it("carries a window that runs past midnight round the clock", () => {
    expect(formatOpeningHours([{ opensAt: 1140, closesAt: 1560 }])).toBe(
      "Open 19:00 to 02:00",
    );
  });

  it("says so when the place is shut all day", () => {
    expect(formatOpeningHours([])).toBe("Closed today");
  });

  it("says nothing when the hours are not known", () => {
    expect(formatOpeningHours(null)).toBeNull();
  });
});
