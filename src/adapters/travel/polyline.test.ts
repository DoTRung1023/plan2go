import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline";

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
