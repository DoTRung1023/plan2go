import { describe, expect, it } from "vitest";
import { isSupportedTimeZone, openingTimeZone, todayIn } from "./time-zones";

describe("isSupportedTimeZone", () => {
  it("accepts an IANA zone", () => {
    expect(isSupportedTimeZone("Australia/Adelaide")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSupportedTimeZone("Middle/Earth")).toBe(false);
  });
});

describe("openingTimeZone", () => {
  it("takes the zone the request came from", () => {
    const headers = new Headers({ "x-vercel-ip-timezone": "Europe/Lisbon" });
    expect(openingTimeZone(headers)).toBe("Europe/Lisbon");
  });

  it("falls back to the server when the header is nonsense", () => {
    const headers = new Headers({ "x-vercel-ip-timezone": "Middle/Earth" });
    expect(isSupportedTimeZone(openingTimeZone(headers))).toBe(true);
  });

  it("falls back to the server when there is no header", () => {
    expect(isSupportedTimeZone(openingTimeZone(new Headers()))).toBe(true);
  });
});

describe("todayIn", () => {
  it("is already tomorrow in Adelaide while it is still today in Lisbon", () => {
    const instant = new Date("2026-09-01T22:00:00Z");
    expect(todayIn("Europe/Lisbon", instant)).toBe("2026-09-01");
    expect(todayIn("Australia/Adelaide", instant)).toBe("2026-09-02");
  });
});
