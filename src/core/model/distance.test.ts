import { describe, expect, it } from "vitest";
import { formatDistance, metersBetween } from "./distance";

const ADELAIDE = { lat: -34.9285, lng: 138.6007 };
const MELBOURNE = { lat: -37.8136, lng: 144.9631 };

describe("metersBetween", () => {
  it("is a degree of the equator for a degree of longitude along it", () => {
    expect(metersBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBe(111195);
  });

  it("is nothing from a place to itself", () => {
    expect(metersBetween(ADELAIDE, ADELAIDE)).toBe(0);
  });

  it("is about 111 km for a degree of latitude", () => {
    const meters = metersBetween({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(meters).toBeGreaterThan(110_500);
    expect(meters).toBeLessThan(111_500);
  });

  it("is the same either way", () => {
    expect(metersBetween(ADELAIDE, MELBOURNE)).toBe(metersBetween(MELBOURNE, ADELAIDE));
  });

  it("is the straight line between two cities", () => {
    const meters = metersBetween(ADELAIDE, MELBOURNE);
    expect(meters).toBeGreaterThan(650_000);
    expect(meters).toBeLessThan(660_000);
  });
});

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
