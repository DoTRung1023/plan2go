import { describe, expect, it } from "vitest";
import type { Place } from "@/core/model/place";
import { directionsUrl, placeUrl } from "./directions-url";

const MARKET: Place = {
  id: "market",
  providerPlaceId: "ChIJmarket",
  name: "Adelaide Central Market",
  address: null,
  position: { lat: -34.9297, lng: 138.5977 },
  openingHours: null,
};

const PIN: Place = {
  id: "pin",
  providerPlaceId: null,
  name: "Somewhere dropped",
  address: null,
  position: { lat: -34.9803, lng: 138.5119 },
  openingHours: null,
};

describe("directionsUrl", () => {
  it("hands both places and the chosen way to Google Maps", () => {
    const url = new URL(directionsUrl(MARKET, PIN, "transit"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("-34.9297,138.5977");
    expect(url.searchParams.get("destination")).toBe("-34.9803,138.5119");
    expect(url.searchParams.get("travelmode")).toBe("transit");
  });

  it("names a place by its identifier where it has one, and only there", () => {
    const url = new URL(directionsUrl(MARKET, PIN, "walk"));
    expect(url.searchParams.get("origin_place_id")).toBe("ChIJmarket");
    expect(url.searchParams.has("destination_place_id")).toBe(false);
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });
});

describe("directionsUrl, at a moment", () => {
  // 10:00 on Saturday 26 September 2026 in Adelaide, which is 00:30 UTC.
  const tenInAdelaide = { epochMinutes: Date.UTC(2026, 8, 26, 0, 30) / 60_000, timeZone: "Australia/Adelaide" };

  it("uses the form of the address that carries a departure, with the way on it", () => {
    const url = directionsUrl(MARKET, PIN, "transit", tenInAdelaide);
    expect(url.startsWith("https://www.google.com/maps/dir/-34.9297,138.5977/-34.9803,138.5119/data=")).toBe(true);
    expect(url.endsWith("!3e3")).toBe(true);
    expect(directionsUrl(MARKET, PIN, "drive", tenInAdelaide).endsWith("!3e0")).toBe(true);
    expect(directionsUrl(MARKET, PIN, "walk", tenInAdelaide).endsWith("!3e2")).toBe(true);
  });

  it("writes the departure as the wall clock at the origin, as though it were UTC", () => {
    const url = directionsUrl(MARKET, PIN, "transit", tenInAdelaide);
    const at = /!8j(\d+)!/.exec(url)?.[1];
    expect(Number(at)).toBe(Date.UTC(2026, 8, 26, 10, 0) / 1000);
  });

  it("falls back to the Maps URLs API when the moment is not known", () => {
    expect(directionsUrl(MARKET, PIN, "transit", null)).toContain("?api=1&");
  });
});

describe("placeUrl", () => {
  it("opens the place by its identifier, with its position beside it", () => {
    const url = new URL(placeUrl(MARKET));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("-34.9297,138.5977");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJmarket");
  });

  it("opens a pin by its position alone", () => {
    const url = new URL(placeUrl(PIN));
    expect(url.searchParams.get("query")).toBe("-34.9803,138.5119");
    expect(url.searchParams.has("query_place_id")).toBe(false);
  });
});
