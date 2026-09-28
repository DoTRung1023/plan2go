import { describe, expect, it } from "vitest";
import type { LandmarkPlace } from "@/core/ports/places-provider";
import { citiesFromLandmarks, countryOf } from "./popular-cities";

function landmark(locality: string | null, region: string | null): LandmarkPlace {
  return { name: "A landmark", locality, region };
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
