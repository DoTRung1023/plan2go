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
