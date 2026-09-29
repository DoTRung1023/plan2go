import { encodePolyline } from "../travel/polyline";
import type { DayPlan } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { StaticMapFrame } from "./static-map-frame";
import { frameAround, STATIC_MAP_SIZE } from "./static-map-frame";

/**
 * A leg as the static map needs it: its two ends, the mode it is travelled by,
 * and the shape of the route between them where somebody knows it.
 */
export interface DrawnLeg {
  readonly from: LatLng;
  readonly to: LatLng;
  readonly mode: TravelMode;
  readonly path: readonly LatLng[] | null;
}

const ENDPOINT = "https://maps.googleapis.com/maps/api/staticmap";

/**
 * The sheet's width in map pixels, doubled for print. A4 less its margins is a
 * little over seven inches, and the shape is the one the design for the
 * printed trip gives the map across the top of a day.
 */
const SIZE = `${String(STATIC_MAP_SIZE.width)}x${String(STATIC_MAP_SIZE.height)}`;
const SCALE = 2;

/**
 * The palette, written again here because a server has no stylesheet to read
 * it from. DESIGN.md and the theme block in globals.css are the two copies that
 * count; this is the third, and it changes in the same commit they do. Only the
 * opaque steps are here, since Google is handed a colour and not a color-mix,
 * and every translucent rule and ink is taken from the neutral ramp, which is
 * the same value at the same weight.
 */
const PAPER = "0xf5ead8";
const PAPER_RAISED = "0xf9f4ed";
const PAPER_SUNKEN = "0xebddc5";
const RULE = "0xdcd3c4";
const RULE_STRONG = "0xc0b6a5";
const INK = "0x201e1d";
const INK_MUTED = "0x645c50";
const INK_FAINT = "0x82796a";

/**
 * The inks the live map draws a day's legs in, one after another and round
 * again: the same six, in the same order, as route-style.ts names as custom
 * properties. A static map cannot dash or dot a line, so on paper the colour
 * is all that tells one leg from the next, and the list beside it says the
 * mode in words.
 */
const LEG_INKS: readonly string[] = [
  "0x8c491a", // terracotta 700
  "0x56633f", // sage 700
  "0xc67139", // terracotta
  "0x645c50", // neutral 700
  "0x728157", // sage 600
  "0x402310", // terracotta 900
];

const ROUTE_WEIGHT = 4;

/**
 * The warm ground, as the static map takes it: one parameter per rule rather
 * than a style array. The same rules the live map is given, so the two maps
 * are one map printed and one map on screen.
 */
const STYLES: readonly string[] = [
  `element:geometry|color:${PAPER}`,
  "element:labels.icon|visibility:off",
  `element:labels.text.fill|color:${INK}`,
  `element:labels.text.stroke|color:${PAPER}`,
  `feature:administrative|element:geometry.stroke|color:${RULE_STRONG}`,
  "feature:administrative.land_parcel|visibility:off",
  `feature:poi|element:geometry|color:${PAPER_SUNKEN}`,
  `feature:poi|element:labels.text.fill|color:${INK_FAINT}`,
  `feature:road|element:geometry|color:${PAPER_RAISED}`,
  `feature:road|element:geometry.stroke|color:${RULE}`,
  `feature:road|element:labels.text.fill|color:${INK_MUTED}`,
  `feature:road.highway|element:geometry.stroke|color:${RULE_STRONG}`,
  `feature:transit|element:geometry|color:${RULE}`,
  `feature:transit|element:labels.text.fill|color:${INK_FAINT}`,
  `feature:water|element:geometry|color:${RULE}`,
  `feature:water|element:labels.text.fill|color:${INK_FAINT}`,
];

/**
 * What the provider will take in one address. Its own limit is 16384
 * characters; this leaves room for the key and for a margin of error, and a
 * route that would not fit is thinned until it does.
 */
const URL_BUDGET = 14_000;

function point(position: LatLng): string {
  return `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
}

/**
 * Every k-th point and the last, so a route drawn with fewer points still
 * ends where it ended. The shape loses detail before it loses its ends.
 */
function thinned(points: readonly LatLng[], keepEvery: number): readonly LatLng[] {
  const kept = points.filter((_unused, index) => index % keepEvery === 0);
  const last = points[points.length - 1];
  return last !== undefined && kept[kept.length - 1] !== last ? [...kept, last] : kept;
}

/**
 * Where the picture of a day looks: at every place on it and every route
 * between them, as close as they all fit. The places are marked on it by
 * whoever draws the picture, with the markers the live map draws, not by the
 * provider, whose pins are its own and could not tell the start of the day
 * from its end; these are the numbers that put them where the provider put
 * the places.
 */
export function staticMapFrame(day: DayPlan, legs: readonly DrawnLeg[]): StaticMapFrame {
  const ends = [day.start, day.end].flatMap((end) => (end === null ? [] : [end.place.position]));
  return frameAround([
    ...ends,
    ...day.stops.map((stop) => stop.place.position),
    ...legs.flatMap((leg) => [leg.from, leg.to, ...(leg.path ?? [])]),
  ]);
}

function pathParam(leg: DrawnLeg, index: number, keepEvery: number): string {
  const ink = LEG_INKS[index % LEG_INKS.length] ?? LEG_INKS[0] ?? "0x8c491a";
  const head = `color:${ink}ff|weight:${String(ROUTE_WEIGHT)}`;
  if (leg.path === null || leg.path.length < 2) {
    // The line between the two ends, which is what the live map draws for a
    // leg nobody could give the shape of.
    return `${head}|${point(leg.from)}|${point(leg.to)}`;
  }
  return `${head}|enc:${encodePolyline(thinned(leg.path, keepEvery))}`;
}

/**
 * The address of one drawn day, less the key. The key is added last, by the
 * caller that holds it, so what is hashed for the cache and what is logged on
 * a failure never carry it.
 *
 * The ground and the routes, with no markers: the centre and the zoom are
 * the day's frame, said outright, so the markers laid over the picture land
 * on the places it shows.
 */
export function googleStaticMapUrl(day: DayPlan, legs: readonly DrawnLeg[]): string {
  const { center, zoom } = staticMapFrame(day, legs);
  for (let keepEvery = 1; ; keepEvery *= 2) {
    const params = new URLSearchParams();
    params.set("center", `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`);
    params.set("zoom", String(zoom));
    params.set("size", SIZE);
    params.set("scale", String(SCALE));
    params.set("maptype", "roadmap");
    params.set("format", "png");
    for (const style of STYLES) {
      params.append("style", style);
    }
    legs.forEach((leg, index) => {
      params.append("path", pathParam(leg, index, keepEvery));
    });
    const url = `${ENDPOINT}?${params.toString()}`;
    // Thinning a route by half each time reaches the budget within a few
    // rounds for any day, and a day of straight lines is already under it.
    if (url.length <= URL_BUDGET || legs.every((leg) => leg.path === null)) {
      return url;
    }
  }
}
