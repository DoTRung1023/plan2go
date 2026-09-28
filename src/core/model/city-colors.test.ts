import { describe, expect, it } from "vitest";
import type { DayCity, DayPlan } from "./day";
import type { CityIdentity } from "./day-city";
import { CITY_COLOR_COUNT, cityKey, colorAfterMove, settleCityColors } from "./city-colors";

function city(name: string, color = 0): DayCity {
  return { providerPlaceId: `g-${name}`, name, position: { lat: 20.25, lng: 105.97 }, color };
}

const NINH_BINH = city("Ninh Binh");
const HANOI = city("Hanoi");
const HA_LONG = city("Ha Long");
const SAIGON = city("Ho Chi Minh City");

function day(id: string, at: DayCity | null): DayPlan {
  return {
    id,
    date: "2026-09-28",
    timeZone: "Asia/Ho_Chi_Minh",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    city: at,
  };
}

const key = (one: CityIdentity): string => cityKey(one);

describe("cityKey", () => {
  it("keys a city by its identifier, and by its name when it has none", () => {
    expect(cityKey(HANOI)).toBe("g-Hanoi");
    expect(cityKey({ providerPlaceId: null, name: "Hanoi" })).toBe("name:Hanoi");
  });
});

describe("settleCityColors", () => {
  it("colours cities in the order the trip reaches them", () => {
    const settled = settleCityColors({}, [NINH_BINH, HANOI, HANOI, HA_LONG, SAIGON]);
    expect(settled).toEqual({
      [key(NINH_BINH)]: 0,
      [key(HANOI)]: 1,
      [key(HA_LONG)]: 2,
      [key(SAIGON)]: 3,
    });
  });

  it("keeps every city's colour when a day moves to a city already on the trip", () => {
    const before = settleCityColors({}, [NINH_BINH, HANOI, HANOI, HA_LONG, SAIGON]);
    const after = settleCityColors(before, [NINH_BINH, HANOI, HANOI, HANOI, SAIGON]);
    expect(after).toEqual({ [key(NINH_BINH)]: 0, [key(HANOI)]: 1, [key(SAIGON)]: 3 });
  });

  it("gives a city nobody is in any more its colour back, for the next new city", () => {
    const before = settleCityColors({}, [NINH_BINH, HANOI, HA_LONG, SAIGON]);
    const hue = city("Hue");
    const after = settleCityColors(before, [NINH_BINH, HANOI, hue, SAIGON]);
    expect(after[key(hue)]).toBe(2);
    expect(after[key(SAIGON)]).toBe(3);
  });

  it("does not move colours when the first day changes city", () => {
    const before = settleCityColors({}, [NINH_BINH, HANOI, HA_LONG]);
    const after = settleCityColors(before, [HANOI, HANOI, HA_LONG]);
    expect(after).toEqual({ [key(HANOI)]: 1, [key(HA_LONG)]: 2 });
  });

  it("goes round again once every colour is held", () => {
    const cities = Array.from({ length: CITY_COLOR_COUNT + 2 }, (_unused, at) => city(`City ${String(at)}`));
    const settled = settleCityColors({}, cities);
    expect(cities.map((one) => settled[key(one)])).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
  });

  it("ignores a stored colour that is not a colour", () => {
    expect(settleCityColors({ [key(HANOI)]: 42 }, [HANOI])).toEqual({ [key(HANOI)]: 0 });
  });

  it("leaves out days with no city", () => {
    expect(settleCityColors({}, [null, HANOI])).toEqual({ [key(HANOI)]: 0 });
  });
});

describe("colorAfterMove", () => {
  const days = [
    day("d1", city("Ninh Binh", 0)),
    day("d2", city("Hanoi", 1)),
    day("d3", city("Hanoi", 1)),
    day("d4", city("Ha Long", 2)),
    day("d5", city("Ho Chi Minh City", 3)),
  ];

  it("is the city's own colour when the trip already goes there", () => {
    expect(colorAfterMove(days, "d4", HANOI)).toBe(1);
  });

  it("is the colour the city left behind gives up, for a city new to the trip", () => {
    expect(colorAfterMove(days, "d4", city("Hue"))).toBe(2);
  });

  it("takes over the colour of a city the whole move leaves behind", () => {
    expect(colorAfterMove(days, "d1", city("Hue"))).toBe(0);
    expect(colorAfterMove(days, "d2", city("Hue"))).toBe(1);
  });

  it("is the first colour nobody holds when every city keeps a day", () => {
    expect(colorAfterMove(days, "d3", city("Hue"))).toBe(4);
  });
});
