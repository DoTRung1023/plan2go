import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { DrawnLeg } from "./google-static-map";
import { googleStaticMapUrl } from "./google-static-map";

function place(name: string, position: LatLng): Place {
  return {
    id: `place-${name}`,
    providerPlaceId: null,
    name,
    address: null,
    position,
    openingHours: null,
  };
}

const HOTEL = { lat: -34.9285, lng: 138.6007 };
const MARKET = { lat: -34.9235, lng: 138.5985 };
const GALLERY = { lat: -34.9209, lng: 138.6039 };

function day(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "day-1",
    date: "2026-09-10",
    timeZone: "Australia/Adelaide",
    label: null,
    start: { place: place("Hotel", HOTEL), label: null },
    end: null,
    startAtMinutes: 9 * 60,
    stops: [
      { id: "stop-1", place: place("Market", MARKET), stayMinutes: 60, travelMode: "walk", note: null },
      { id: "stop-2", place: place("Gallery", GALLERY), stayMinutes: 60, travelMode: "drive", note: null },
    ],
    endTravelMode: "walk",
    ...overrides,
  };
}

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("googleStaticMapUrl", () => {
  it("numbers the stops in the accent and marks the ends in sage", () => {
    const markers = params(googleStaticMapUrl(day(), [])).getAll("markers");

    expect(markers).toEqual([
      "size:mid|color:0xc67139|label:1|-34.92350,138.59850",
      "size:mid|color:0xc67139|label:2|-34.92090,138.60390",
      "size:small|color:0x728157|-34.92850,138.60070",
    ]);
  });

  it("leaves the tenth stop and after without a label, which the provider cannot draw", () => {
    const stops = Array.from({ length: 11 }, (_unused, index) => ({
      id: `stop-${String(index)}`,
      place: place(`Stop ${String(index)}`, { lat: -34.9 - index / 1000, lng: 138.6 }),
      stayMinutes: 30,
      travelMode: "walk" as const,
      note: null,
    }));
    const markers = params(googleStaticMapUrl(day({ start: null, stops }), [])).getAll("markers");

    expect(markers[8]).toContain("label:9");
    expect(markers[9]).not.toContain("label:");
    expect(markers[10]).not.toContain("label:");
  });

  it("draws a leg with a shape as an encoded route in its mode's colour", () => {
    const leg: DrawnLeg = {
      from: HOTEL,
      to: MARKET,
      mode: "walk",
      path: [HOTEL, { lat: -34.926, lng: 138.5995 }, MARKET],
    };
    const paths = params(googleStaticMapUrl(day(), [leg])).getAll("path");

    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^color:0xb2622dff\|weight:4\|enc:.+$/);
  });

  it("draws a leg with no shape as the line between its ends", () => {
    const leg: DrawnLeg = { from: MARKET, to: GALLERY, mode: "drive", path: null };
    const paths = params(googleStaticMapUrl(day(), [leg])).getAll("path");

    expect(paths).toEqual([
      "color:0x8c491aff|weight:4|-34.92350,138.59850|-34.92090,138.60390",
    ]);
  });

  it("carries no key and no centre, and fits the map to what is on it", () => {
    const url = googleStaticMapUrl(day(), []);

    expect(params(url).has("key")).toBe(false);
    expect(params(url).has("center")).toBe(false);
    expect(params(url).has("zoom")).toBe(false);
    expect(params(url).get("size")).toBe("640x320");
    expect(params(url).get("scale")).toBe("2");
  });

  it("thins a route that would not fit in one address until it does", () => {
    const long: LatLng[] = Array.from({ length: 6000 }, (_unused, index) => ({
      lat: -34.9 + Math.sin(index / 7) / 100,
      lng: 138.6 + index / 1000,
    }));
    const leg: DrawnLeg = { from: HOTEL, to: MARKET, mode: "drive", path: long };

    const url = googleStaticMapUrl(day(), [leg]);

    expect(url.length).toBeLessThanOrEqual(14_000);
    expect(params(url).getAll("path")[0]).toContain("enc:");
  });
});
