import type { LatLng } from "@/core/model/place";

/**
 * Google returns the shape of a route as an encoded polyline: each point as a
 * difference from the one before it, in hundred thousandths of a degree, packed
 * five bits at a time into printable characters.
 *
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
const CHUNK_BITS = 5;

const CONTINUES = 0x20;

const CHUNK_MASK = 0x1f;

const ASCII_OFFSET = 63;

const DEGREES_SCALE = 1e5;

interface Read {
  readonly value: number;
  readonly next: number;
}

/** One signed number, and where the next one starts. */
function readValue(encoded: string, from: number): Read {
  let result = 0;
  let shift = 0;
  let index = from;
  let byte = CONTINUES;

  while (byte >= CONTINUES && index < encoded.length) {
    byte = encoded.charCodeAt(index) - ASCII_OFFSET;
    index += 1;
    result |= (byte & CHUNK_MASK) << shift;
    shift += CHUNK_BITS;
  }

  // The low bit says the value was negative, and the rest is the magnitude.
  return { value: (result & 1) === 1 ? ~(result >> 1) : result >> 1, next: index };
}

/**
 * The points of a route, in order. An empty or unreadable string gives no
 * points, which the map reads as having no shape to draw rather than as an
 * error, and it falls back to the straight line between the two ends.
 */
export function decodePolyline(encoded: string): readonly LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latitude = readValue(encoded, index);
    if (latitude.next >= encoded.length) {
      break;
    }
    const longitude = readValue(encoded, latitude.next);
    index = longitude.next;
    lat += latitude.value;
    lng += longitude.value;
    points.push({ lat: lat / DEGREES_SCALE, lng: lng / DEGREES_SCALE });
  }

  return points;
}

/** One signed number, packed the way Google packs it. */
function writeValue(value: number): string {
  // The sign goes in the low bit, so a negative number is inverted rather than
  // negated and every value is left non-negative for the chunking below.
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (remaining >= CONTINUES) {
    out += String.fromCharCode(((remaining & CHUNK_MASK) | CONTINUES) + ASCII_OFFSET);
    remaining >>= CHUNK_BITS;
  }
  return out + String.fromCharCode(remaining + ASCII_OFFSET);
}

/**
 * The points of a route back into Google's own encoding, for handing a shape
 * to the static map, which takes a route as an encoded polyline and nothing
 * else. Decoding what this writes gives the same points back to five decimal
 * places, which is the precision the encoding has.
 */
export function encodePolyline(points: readonly LatLng[]): string {
  let out = "";
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    const nextLat = Math.round(point.lat * DEGREES_SCALE);
    const nextLng = Math.round(point.lng * DEGREES_SCALE);
    out += writeValue(nextLat - lat) + writeValue(nextLng - lng);
    lat = nextLat;
    lng = nextLng;
  }
  return out;
}
