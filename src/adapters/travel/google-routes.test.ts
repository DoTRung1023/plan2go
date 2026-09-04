import { describe, expect, it } from "vitest";
import { minutesFromDuration } from "./google-routes";

describe("minutesFromDuration", () => {
  it("reads the seconds Google answers with", () => {
    expect(minutesFromDuration("1200s")).toBe(20);
  });

  it("rounds to the whole minutes the engine works in", () => {
    expect(minutesFromDuration("1234s")).toBe(21);
    expect(minutesFromDuration("29s")).toBe(0);
  });

  it("reads a fractional second without choking on it", () => {
    expect(minutesFromDuration("90.5s")).toBe(2);
  });
});
