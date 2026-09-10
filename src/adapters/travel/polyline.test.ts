import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "./polyline";

describe("decodePolyline", () => {
  it("reads the three points from Google's own worked example", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    expect(points).toHaveLength(3);
    expect(points[0]?.lat).toBeCloseTo(38.5, 5);
    expect(points[0]?.lng).toBeCloseTo(-120.2, 5);
    expect(points[1]?.lat).toBeCloseTo(40.7, 5);
    expect(points[1]?.lng).toBeCloseTo(-120.95, 5);
    expect(points[2]?.lat).toBeCloseTo(43.252, 5);
    expect(points[2]?.lng).toBeCloseTo(-126.453, 5);
  });

  it("has no shape for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("stops rather than inventing a point from a half written pair", () => {
    expect(decodePolyline("_p~iF")).toEqual([]);
  });
});

describe("encodePolyline", () => {
  it("writes Google's own worked example back the way it came", () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];

    expect(encodePolyline(points)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("survives a round trip to the precision the encoding has", () => {
    const points = [
      { lat: -34.92866, lng: 138.59863 },
      { lat: -34.92001, lng: 138.60612 },
      { lat: 21.02776, lng: 105.83416 },
    ];

    const back = decodePolyline(encodePolyline(points));

    expect(back).toHaveLength(3);
    back.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(points[index]?.lat ?? 0, 5);
      expect(point.lng).toBeCloseTo(points[index]?.lng ?? 0, 5);
    });
  });

  it("writes nothing for no points", () => {
    expect(encodePolyline([])).toBe("");
  });
});
