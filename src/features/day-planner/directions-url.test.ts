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
