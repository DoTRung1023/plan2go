import { describe, expect, it } from "vitest";
import { rideSentence } from "./transit-ride";

describe("rideSentence", () => {
  it("says what to catch, which way, where to get on and off, and for how long", () => {
    expect(
      rideSentence({
        vehicle: "tram",
        line: "GLNELG",
        headsign: "Glenelg",
        boardAt: "Rundle Mall",
        alightAt: "Stop 17 Moseley Square",
        stops: 21,
        durationMinutes: 38,
      }),
    ).toBe("Tram GLNELG towards Glenelg · Rundle Mall to Stop 17 Moseley Square · 21 stops · 38 min");
  });

  it("leaves out what the provider did not say rather than leaving a gap", () => {
    expect(
      rideSentence({
        vehicle: "bus",
        line: null,
        headsign: null,
        boardAt: "Currie St",
        alightAt: null,
        stops: 1,
        durationMinutes: 4,
      }),
    ).toBe("Bus · 1 stop · 4 min");
  });
});
