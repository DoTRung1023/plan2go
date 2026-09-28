import { describe, expect, it } from "vitest";
import type { LatLng } from "@/core/model/place";
import type { LandmarkPlace } from "@/core/ports/places-provider";
import { citiesFromLandmarks, countryOf, nearestFirst, townsFromLandmarks } from "./cities-to-visit";

function landmark(locality: string | null, region: string | null): LandmarkPlace {
  return { name: "A landmark", locality, region };
}

const ADELAIDE: LatLng = { lat: -34.9285, lng: 138.6007 };

function placed(name: string, position: LatLng) {
  return { city: { providerPlaceId: `id-${name}`, name, address: null }, position };
}

describe("citiesFromLandmarks", () => {
  it("ranks cities by how many landmarks are in them", () => {
    const landmarks = [
      landmark("Hue", "Hue"),
      landmark(null, "Đà Nẵng"),
      landmark(null, "Đà Nẵng"),
      landmark("Sa Pa", "Lào Cai"),
    ];
    expect(citiesFromLandmarks(landmarks, 8)).toEqual(["Đà Nẵng", "Hue", "Sa Pa"]);
  });

  it("takes the province for a landmark whose address names no town", () => {
    expect(citiesFromLandmarks([landmark(null, "Hà Nội")], 8)).toEqual(["Hà Nội"]);
  });

  it("takes the province as the city when its landmarks name several towns", () => {
    const landmarks = [
      landmark("Taito City", "Tokyo"),
      landmark("Minato City", "Tokyo"),
      landmark("Shibuya", "Tokyo"),
      landmark("Kyoto", "Kyoto"),
      landmark("Kyoto", "Kyoto"),
    ];
    expect(citiesFromLandmarks(landmarks, 8)).toEqual(["Tokyo", "Kyoto"]);
  });

  it("counts one province spelt with and without its accents as one", () => {
    const landmarks = [landmark("Tay Hoa Lu", "Ninh Binh"), landmark("Hoa Lư", "Ninh Bình")];
    expect(citiesFromLandmarks(landmarks, 8)).toEqual(["Ninh Binh"]);
  });

  it("keeps the provider's order between cities with as many landmarks", () => {
    const landmarks = [landmark("Hue", "Hue"), landmark("Sa Pa", "Lào Cai")];
    expect(citiesFromLandmarks(landmarks, 8)).toEqual(["Hue", "Sa Pa"]);
  });

  it("leaves out a landmark whose address says nothing about where it is", () => {
    expect(citiesFromLandmarks([landmark(null, null), landmark("Hue", "Hue")], 8)).toEqual(["Hue"]);
  });

  it("stops at the number asked for", () => {
    const landmarks = [landmark("Hue", "Hue"), landmark("Sa Pa", "Lào Cai"), landmark("Phu Quoc", "An Giang")];
    expect(citiesFromLandmarks(landmarks, 2)).toEqual(["Hue", "Sa Pa"]);
  });

  it("counts a name written as one word and as two as one place", () => {
    const landmarks = [landmark(null, "Hà Nội"), landmark(null, "Hanoi"), landmark("Hue", "Hue")];
    expect(citiesFromLandmarks(landmarks, 8)).toEqual(["Hà Nội", "Hue"]);
  });
});

describe("townsFromLandmarks", () => {
  it("ranks the towns near a city by how many landmarks are in them", () => {
    const landmarks = [
      landmark("Hahndorf", "South Australia"),
      landmark("Tanunda", "South Australia"),
      landmark("Tanunda", "South Australia"),
    ];
    expect(townsFromLandmarks(landmarks, "Adelaide", 8)).toEqual(["Tanunda", "Hahndorf"]);
  });

  it("never takes the province for a town, however many towns it has", () => {
    const landmarks = [landmark("Hahndorf", "South Australia"), landmark("Victor Harbor", "South Australia")];
    expect(townsFromLandmarks(landmarks, "Adelaide", 8)).toEqual(["Hahndorf", "Victor Harbor"]);
  });

  it("leaves out the city itself, however it is spelt", () => {
    const landmarks = [
      landmark(null, "Hà Nội"),
      landmark("Hanoi", "Hanoi"),
      landmark("Ha Long", "Quảng Ninh"),
    ];
    expect(townsFromLandmarks(landmarks, "Hanoi", 8)).toEqual(["Ha Long"]);
  });

  it("takes the province for a landmark whose address names no town", () => {
    expect(townsFromLandmarks([landmark(null, "Ninh Bình")], "Hanoi", 8)).toEqual(["Ninh Bình"]);
  });

  it("stops at the number asked for", () => {
    const landmarks = [landmark("Hahndorf", null), landmark("Clare", null), landmark("Tanunda", null)];
    expect(townsFromLandmarks(landmarks, "Adelaide", 2)).toEqual(["Hahndorf", "Clare"]);
  });
});

describe("nearestFirst", () => {
  const MELBOURNE = placed("Melbourne", { lat: -37.8136, lng: 144.9631 });
  const HAHNDORF = placed("Hahndorf", { lat: -35.0286, lng: 138.8078 });
  const PERTH = placed("Perth", { lat: -31.9523, lng: 115.8613 });

  it("puts the cities in order of how far they are", () => {
    const cities = nearestFirst(ADELAIDE, [MELBOURNE, PERTH, HAHNDORF], 8);
    expect(cities.map((city) => city.name)).toEqual(["Hahndorf", "Melbourne", "Perth"]);
  });

  it("leaves out a place so close it is the city itself", () => {
    const glenelg = placed("Glenelg", { lat: -34.9803, lng: 138.5083 });
    expect(nearestFirst(ADELAIDE, [glenelg, HAHNDORF], 8).map((city) => city.name)).toEqual([
      "Hahndorf",
    ]);
  });

  it("keeps the nearest when there are more than asked for", () => {
    const cities = nearestFirst(ADELAIDE, [PERTH, MELBOURNE, HAHNDORF], 2);
    expect(cities.map((city) => city.name)).toEqual(["Hahndorf", "Melbourne"]);
  });
});

describe("countryOf", () => {
  it("is the last part of an address", () => {
    expect(countryOf("Hanoi, Ha Noi, Vietnam")).toBe("Vietnam");
    expect(countryOf("Kyoto, Japan")).toBe("Japan");
  });

  it("is nothing for no address", () => {
    expect(countryOf(null)).toBeNull();
    expect(countryOf("")).toBeNull();
  });
});
