import type { LatLng } from "@/core/model/place";

/**
 * The static map's picture in its own pixels, which is what the provider is
 * told and what a place is placed in. The file comes back at twice this, for
 * print, and is drawn on the sheet at whatever width the sheet gives it.
 * Wide and low, a little under three to one, the shape the design for the
 * printed trip gives the map across the top of a day.
 */
export const STATIC_MAP_SIZE = { width: 640, height: 216 } as const;

/** How wide the whole world is at zoom 0, in the provider's pixels. */
const WORLD_PX = 256;

/**
 * Kept clear at every edge, so a marker drawn on a place at the edge of the
 * day is on the map whole: a stop's disc reaches seventeen from its place.
 */
const MARGIN_PX = 24;

/** The live map's zoom for a day with one place on it and nothing to fit. */
const SINGLE_POINT_ZOOM = 14;

/**
 * Closest the map goes, so two places across a street from each other are
 * still seen in the streets around them rather than as two discs on a roof.
 */
const MAX_ZOOM = 17;

/** Where a map with nothing on it looks, as the live map does. */
const WHOLE_WORLD: StaticMapFrame = { center: { lat: 20, lng: 0 }, zoom: 2 };

/** Decimal places the centre is written to, and so the centre that is drawn. */
const CENTRE_DECIMALS = 6;

/**
 * Where the picture looks and how close: said to the provider outright rather
 * than left to it, so the same numbers can put a marker on a place in the
 * picture it sends back.
 */
export interface StaticMapFrame {
  readonly center: LatLng;
  readonly zoom: number;
}

/** A place in the world's pixels at zoom 0, Web Mercator as the provider draws it. */
function toWorld({ lat, lng }: LatLng): { readonly x: number; readonly y: number } {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * WORLD_PX,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD_PX,
  };
}

function fromWorld(x: number, y: number): LatLng {
  const n = Math.PI * (1 - (2 * y) / WORLD_PX);
  return {
    lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    lng: (x / WORLD_PX) * 360 - 180,
  };
}

function rounded(value: number): number {
  return Number(value.toFixed(CENTRE_DECIMALS));
}

/**
 * The frame that holds every point with the margin to spare: centred on the
 * middle of them in the map's own terms rather than in degrees, since a degree
 * of latitude is not the same height everywhere, and at the closest whole
 * zoom they fit, because the provider only draws whole ones.
 */
export function frameAround(points: readonly LatLng[]): StaticMapFrame {
  if (points.length === 0) {
    return WHOLE_WORLD;
  }
  const world = points.map(toWorld);
  const xs = world.map((point) => point.x);
  const ys = world.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  const across = (STATIC_MAP_SIZE.width - 2 * MARGIN_PX) / (right - left);
  const down = (STATIC_MAP_SIZE.height - 2 * MARGIN_PX) / (bottom - top);
  const fits = Math.min(across, down);
  const zoom = Number.isFinite(fits)
    ? Math.min(Math.max(Math.floor(Math.log2(fits)), 0), MAX_ZOOM)
    : SINGLE_POINT_ZOOM;

  const middle = fromWorld((left + right) / 2, (top + bottom) / 2);
  return { center: { lat: rounded(middle.lat), lng: rounded(middle.lng) }, zoom };
}

/** Where a place lands in the frame's picture, in its pixels from the top left. */
export function placeInFrame(
  frame: StaticMapFrame,
  position: LatLng,
): { readonly x: number; readonly y: number } {
  const scale = 2 ** frame.zoom;
  const centre = toWorld(frame.center);
  const point = toWorld(position);
  return {
    x: STATIC_MAP_SIZE.width / 2 + (point.x - centre.x) * scale,
    y: STATIC_MAP_SIZE.height / 2 + (point.y - centre.y) * scale,
  };
}
