import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { DrawnLeg } from "./google-static-map";
import { googleStaticMapUrl, staticMapFrame } from "./google-static-map";
import { placeInFrame, STATIC_MAP_SIZE } from "./static-map-frame";

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
    city: null,
    ...overrides,
  };
}

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("googleStaticMapUrl", () => {
  it("draws no markers of its own: the sheet lays the live map's over the picture", () => {
    expect(params(googleStaticMapUrl(day(), [])).has("markers")).toBe(false);
  });

  it("frames every place and every route, so each marker lands on the picture", () => {
    const detour: DrawnLeg = {
      from: MARKET,
      to: GALLERY,
      mode: "drive",
      path: [MARKET, { lat: -34.9, lng: 138.62 }, GALLERY],
    };
    const frame = staticMapFrame(day(), [detour]);

    for (const point of [HOTEL, MARKET, GALLERY, { lat: -34.9, lng: 138.62 }]) {
      const at = placeInFrame(frame, point);
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(STATIC_MAP_SIZE.width);
      expect(at.y).toBeGreaterThan(0);
      expect(at.y).toBeLessThan(STATIC_MAP_SIZE.height);
    }
  });

  it("draws a leg with a shape as an encoded route, in the first leg's ink", () => {
    const leg: DrawnLeg = {
      from: HOTEL,
      to: MARKET,
      mode: "walk",
      path: [HOTEL, { lat: -34.926, lng: 138.5995 }, MARKET],
    };
    const paths = params(googleStaticMapUrl(day(), [leg])).getAll("path");

    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^color:0x8c491aff\|weight:4\|enc:.+$/);
  });

  it("gives each leg the next ink in turn, whatever its mode", () => {
    const legs: DrawnLeg[] = [
      { from: HOTEL, to: MARKET, mode: "drive", path: null },
      { from: MARKET, to: GALLERY, mode: "drive", path: null },
      { from: GALLERY, to: HOTEL, mode: "walk", path: null },
    ];
    const paths = params(googleStaticMapUrl(day(), legs)).getAll("path");

    expect(paths.map((path) => path.slice(0, "color:0x000000ff".length))).toEqual([
      "color:0x8c491aff",
      "color:0x56633fff",
      "color:0xc67139ff",
    ]);
  });

  it("draws a leg with no shape as the line between its ends", () => {
    const leg: DrawnLeg = { from: MARKET, to: GALLERY, mode: "drive", path: null };
    const paths = params(googleStaticMapUrl(day(), [leg])).getAll("path");

    expect(paths).toEqual([
      "color:0x8c491aff|weight:4|-34.92350,138.59850|-34.92090,138.60390",
    ]);
  });

  it("carries no key, and says the day's frame outright", () => {
    const url = googleStaticMapUrl(day(), []);
    const { center, zoom } = staticMapFrame(day(), []);

    expect(params(url).has("key")).toBe(false);
    expect(params(url).get("center")).toBe(`${center.lat.toFixed(6)},${center.lng.toFixed(6)}`);
    expect(params(url).get("zoom")).toBe(String(zoom));
    expect(params(url).get("size")).toBe("640x216");
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
