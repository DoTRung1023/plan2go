import { describe, expect, it } from "vitest";
import { frameAround, placeInFrame, STATIC_MAP_SIZE } from "./static-map-frame";

const HANOI = [
  { lat: 21.0368, lng: 105.8346 },
  { lat: 21.0254, lng: 105.8466 },
  { lat: 21.0036, lng: 105.7358 },
  { lat: 21.0558, lng: 105.8322 },
];

describe("frameAround", () => {
  it("puts its own centre in the middle of the picture", () => {
    const frame = frameAround(HANOI);
    const middle = placeInFrame(frame, frame.center);

    expect(middle.x).toBeCloseTo(STATIC_MAP_SIZE.width / 2, 6);
    expect(middle.y).toBeCloseTo(STATIC_MAP_SIZE.height / 2, 6);
  });

  it("holds every point inside the margin, at a whole zoom", () => {
    const frame = frameAround(HANOI);

    expect(Number.isInteger(frame.zoom)).toBe(true);
    for (const point of HANOI) {
      const at = placeInFrame(frame, point);
      expect(at.x).toBeGreaterThanOrEqual(24);
      expect(at.x).toBeLessThanOrEqual(STATIC_MAP_SIZE.width - 24);
      expect(at.y).toBeGreaterThanOrEqual(24);
      expect(at.y).toBeLessThanOrEqual(STATIC_MAP_SIZE.height - 24);
    }
  });

  it("is as close as it can be: one zoom closer and a point falls outside", () => {
    const frame = frameAround(HANOI);
    const closer = { ...frame, zoom: frame.zoom + 1 };
    const outside = HANOI.some((point) => {
      const at = placeInFrame(closer, point);
      return at.x < 24 || at.x > STATIC_MAP_SIZE.width - 24 || at.y < 24 || at.y > STATIC_MAP_SIZE.height - 24;
    });

    expect(outside).toBe(true);
  });

  it("gives a single place the live map's zoom", () => {
    expect(frameAround([{ lat: 21.03, lng: 105.85 }])).toEqual({
      center: { lat: 21.03, lng: 105.85 },
      zoom: 14,
    });
  });

  it("goes no closer than the street around two neighbouring places", () => {
    const frame = frameAround([
      { lat: 21.03, lng: 105.85 },
      { lat: 21.03001, lng: 105.85001 },
    ]);

    expect(frame.zoom).toBe(17);
  });

  it("writes the centre to the places it is sent to the provider with", () => {
    const { center } = frameAround(HANOI);

    expect(center.lat).toBe(Number(center.lat.toFixed(6)));
    expect(center.lng).toBe(Number(center.lng.toFixed(6)));
  });

  it("looks at the world when there is nothing to frame", () => {
    expect(frameAround([])).toEqual({ center: { lat: 20, lng: 0 }, zoom: 2 });
  });
});
