import { describe, expect, it } from "vitest";
import type { TravelRequest } from "@/core/model/leg";
import {
  minutesFromDuration,
  ridesFromSteps,
  transitDepartureFor,
  transitWaitMinutes,
} from "./google-routes";

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

describe("transitDepartureFor", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  const minutesAt = (iso: string): number => new Date(iso).getTime() / 60_000;
  const leg = (mode: TravelRequest["mode"], departAt: number | null): TravelRequest => ({
    from: { lat: -34.93, lng: 138.6 },
    to: { lat: -34.92, lng: 138.61 },
    mode,
    departAt,
  });

  it("sends the moment the day sets out on a public transport leg", () => {
    const request = leg("transit", minutesAt("2026-09-26T23:30:00Z"));
    expect(transitDepartureFor(request, now)).toBe("2026-09-26T23:30:00.000Z");
  });

  it("sends nothing for a leg with no known departure", () => {
    expect(transitDepartureFor(leg("transit", null), now)).toBeNull();
  });

  it("sends nothing for a walk or a drive, which are asked for without a time", () => {
    const at = minutesAt("2026-09-23T00:00:00Z");
    expect(transitDepartureFor(leg("walk", at), now)).toBeNull();
    expect(transitDepartureFor(leg("drive", at), now)).toBeNull();
  });

  it("sends nothing further from now than the timetable reaches", () => {
    expect(transitDepartureFor(leg("transit", minutesAt("2026-09-14T00:00:00Z")), now)).toBeNull();
    expect(transitDepartureFor(leg("transit", minutesAt("2027-01-15T00:00:00Z")), now)).toBeNull();
    expect(transitDepartureFor(leg("transit", minutesAt("2026-09-16T00:00:00Z")), now)).not.toBeNull();
    expect(transitDepartureFor(leg("transit", minutesAt("2026-12-30T00:00:00Z")), now)).not.toBeNull();
  });
});

describe("transitWaitMinutes", () => {
  const askedFor = new Date("2026-09-19T06:26:00Z").getTime() / 60_000;
  const ride = (departureTime: string) => ({
    transitDetails: { stopDetails: { departureTime }, transitLine: { name: "Bus 32" } },
  });

  it("is how long the first vehicle is waited for", () => {
    const steps = [{ staticDuration: "300s" }, ride("2026-09-19T06:41:00Z"), ride("2026-09-19T07:30:00Z")];
    expect(transitWaitMinutes(steps, askedFor)).toBe(15);
  });

  it("counts a vehicle that leaves the next morning as the wait it is", () => {
    expect(transitWaitMinutes([ride("2026-09-19T22:15:00Z")], askedFor)).toBe(949);
  });

  it("is unknown without a moment asked for, or without a vehicle", () => {
    expect(transitWaitMinutes([ride("2026-09-19T06:41:00Z")], null)).toBeNull();
    expect(transitWaitMinutes([{ staticDuration: "300s" }], askedFor)).toBeNull();
  });
});
