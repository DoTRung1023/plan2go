import { describe, expect, it } from "vitest";
import { minutesFromDuration, ridesFromSteps } from "./google-routes";

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

describe("ridesFromSteps", () => {
  it("keeps the vehicles and leaves out the walks between them", () => {
    // The shape Google answered for Rundle Mall to Glenelg Beach.
    const rides = ridesFromSteps([
      { staticDuration: "281s" },
      {
        staticDuration: "2298s",
        transitDetails: {
          headsign: "Glenelg",
          stopCount: 21,
          stopDetails: {
            departureStop: { name: "Rundle Mall" },
            arrivalStop: { name: "Stop 17 Moseley Square" },
          },
          transitLine: {
            name: "Glenelg to Royal Adelaide Hospital",
            nameShort: "GLNELG",
            vehicle: { type: "TRAM" },
          },
        },
      },
      { staticDuration: "12s" },
    ]);
    expect(rides).toEqual([
      {
        vehicle: "tram",
        line: "GLNELG",
        headsign: "Glenelg",
        boardAt: "Rundle Mall",
        alightAt: "Stop 17 Moseley Square",
        stops: 21,
        durationMinutes: 38,
      },
    ]);
  });

  it("folds a vehicle it has no word for into other rather than dropping the ride", () => {
    const [ride] = ridesFromSteps([
      { transitDetails: { transitLine: { name: "Skyway", vehicle: { type: "GONDOLA_LIFT" } } } },
    ]);
    expect(ride?.vehicle).toBe("other");
    expect(ride?.line).toBe("Skyway");
    expect(ride?.durationMinutes).toBe(0);
  });
});
