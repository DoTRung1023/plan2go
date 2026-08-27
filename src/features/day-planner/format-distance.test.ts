import { describe, expect, it } from "vitest";
import { formatDistance } from "./format-distance";

describe("formatDistance", () => {
  it("stays in metres below a kilometre", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(285)).toBe("285 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("drops a trailing zero rather than writing 1.0 km", () => {
    expect(formatDistance(1000)).toBe("1 km");
  });

  it("keeps one decimal under ten kilometres", () => {
    expect(formatDistance(1491)).toBe("1.5 km");
    expect(formatDistance(9949)).toBe("9.9 km");
  });

  it("rounds to whole kilometres from ten up", () => {
    expect(formatDistance(12029)).toBe("12 km");
  });
});
