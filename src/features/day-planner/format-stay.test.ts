import { describe, expect, it } from "vitest";
import { formatStay } from "./format-stay";

describe("formatStay", () => {
  it("keeps the unit on a stay of less than an hour", () => {
    expect(formatStay(45)).toBe("45 min");
    expect(formatStay(15)).toBe("15 min");
  });

  it("says a whole number of hours as hours", () => {
    expect(formatStay(60)).toBe("1 hr");
    expect(formatStay(180)).toBe("3 hr");
  });

  it("drops the trailing unit once an hour is in front of it", () => {
    expect(formatStay(90)).toBe("1 hr 30");
    expect(formatStay(100)).toBe("1 hr 40");
  });

  it("holds the longest stay the server will take", () => {
    expect(formatStay(99 * 60 + 59)).toBe("99 hr 59");
  });

  it("does not go below nothing", () => {
    expect(formatStay(-10)).toBe("0 min");
  });
});
