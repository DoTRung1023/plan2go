import type { DayEndpoint } from "@/core/model/day";

/**
 * A marker that is our own DOM rather than Google's.
 *
 * DESIGN.md is specific about these: a stop is a numbered disc with a 2px
 * terracotta ring, an endpoint is a sage square with one corner cut, and both
 * carry a name that is read out but never drawn. Google's own markers take an image, so
 * an OverlayView is what lets the markup and the tokens stay in this repo.
 *
 * The class is built after the script loads, because OverlayView does not exist
 * until then.
 */
export function placeDomMarker(
  maps: typeof google.maps,
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  content: HTMLElement,
): google.maps.OverlayView {
  const overlay = new maps.OverlayView();

  overlay.onAdd = () => {
    overlay.getPanes()?.floatPane.append(content);
  };

  overlay.draw = () => {
    // Typed as always present, but it is not: draw fires before the panes are
    // ready, and again when the map never authenticated at all.
    const projection: google.maps.MapCanvasProjection | undefined = overlay.getProjection();
    if (projection === undefined) {
      return;
    }
    const point = projection.fromLatLngToDivPixel(new maps.LatLng(position));
    if (point === null) {
      return;
    }
    content.style.left = `${String(point.x)}px`;
    content.style.top = `${String(point.y)}px`;
  };

  overlay.onRemove = () => {
    content.remove();
  };

  overlay.setMap(map);
  return overlay;
}

/**
 * Whether something pressed is one of these markers or inside one. They are
 * laid over the map, so a press on one reaches the map under it as well.
 */
export function isOnMarker(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".trip-map-marker") !== null;
}

/** A numbered stop. Text goes in as text, so nothing has to be escaped. */
export function stopMarkerElement(order: number, name: string): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-stop";

  const number = document.createElement("span");
  number.setAttribute("aria-hidden", "true");
  number.textContent = String(order);

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `Stop ${String(order)}, ${name}`;

  marker.append(number, spoken);
  return marker;
}

/** The pin the search list draws beside each place, and the empty day in its middle. */
const PIN_PATHS = [
  "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
  "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
];

/**
 * A place being looked at from a search, not on the day yet. The same pin the
 * search list draws beside each place, drawn large and on nothing: not a disc
 * like a stop, since it has no place in the order, and not ringed, since the
 * map has just gone to it. Its tip is on the place. The glyph is drawn twice,
 * a wide stroke of paper under the terracotta one, so it reads over a road
 * name or a river the way a line with a casing does.
 */
export function candidateMarkerElement(name: string): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-candidate";

  const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  glyph.setAttribute("aria-hidden", "true");
  glyph.setAttribute("viewBox", "0 0 24 24");
  glyph.setAttribute("width", "40");
  glyph.setAttribute("height", "40");
  glyph.setAttribute("fill", "none");
  glyph.setAttribute("stroke-linecap", "round");
  glyph.setAttribute("stroke-linejoin", "round");
  for (const [stroke, width] of [
    ["var(--color-paper)", "5.5"],
    ["currentColor", "2.5"],
  ] as const) {
    for (const d of PIN_PATHS) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", stroke);
      path.setAttribute("stroke-width", width);
      glyph.append(path);
    }
  }

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `${name}, being looked at`;

  marker.append(glyph, spoken);
  return marker;
}

/** Which end of the day a marker stands for, or both where they are one place. */
export type EndpointKind = "start" | "end" | "both";

/**
 * The same glyphs the panel draws, so a place is one shape wherever it is: a
 * house where the day sets out from, a flag where it finishes. One place that
 * is both gets the house, because there and back is what a house says. Drawn
 * the same on the live map and on the printed one.
 */
export const ENDPOINT_MARKS: Readonly<
  Record<EndpointKind, { readonly word: string; readonly paths: readonly string[] }>
> = {
  start: {
    word: "Start",
    paths: ["m3 10 9-7 9 7v10a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z", "M9.5 21.5v-7h5v7"],
  },
  end: {
    word: "End",
    paths: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  },
  both: {
    word: "Start and end",
    paths: ["m3 10 9-7 9 7v10a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z", "M9.5 21.5v-7h5v7"],
  },
};

/**
 * How an end's glyph is drawn in its marker on the live map. The width is in
 * the glyph's own 24 units, which the size divides down: a stroke drawn as
 * thin as a small marker is small would be a smudge rather than the lines of
 * a house, so it is widened as the glyph narrows. The printed map, whose
 * marks are smaller, keeps its own.
 */
export const ENDPOINT_GLYPH = { size: 13, strokeWidth: 3 } as const;

/**
 * The markers the ends of a day are drawn as, in the order they are drawn: one
 * for a day that starts and ends in the same place rather than two on top of
 * each other, and it answers as the start, since it is the same place.
 */
export function endpointMarks(
  start: DayEndpoint | null,
  end: DayEndpoint | null,
): readonly { readonly endpoint: DayEndpoint; readonly kind: EndpointKind }[] {
  if (start !== null && end !== null && start.place.id === end.place.id) {
    return [{ endpoint: start, kind: "both" }];
  }
  return [
    ...(start === null ? [] : [{ endpoint: start, kind: "start" as const }]),
    ...(end === null ? [] : [{ endpoint: end, kind: "end" as const }]),
  ];
}

/** An end of the day. Which end decides the glyph and what is read out. */
export function endpointMarkerElement(kind: EndpointKind, name: string): HTMLElement {
  const mark = ENDPOINT_MARKS[kind];
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-endpoint";

  const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  glyph.setAttribute("aria-hidden", "true");
  glyph.setAttribute("viewBox", "0 0 24 24");
  glyph.setAttribute("width", String(ENDPOINT_GLYPH.size));
  glyph.setAttribute("height", String(ENDPOINT_GLYPH.size));
  glyph.setAttribute("fill", "none");
  glyph.setAttribute("stroke", "currentColor");
  glyph.setAttribute("stroke-width", String(ENDPOINT_GLYPH.strokeWidth));
  glyph.setAttribute("stroke-linecap", "round");
  glyph.setAttribute("stroke-linejoin", "round");
  for (const d of mark.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    glyph.append(path);
  }

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `${mark.word} of the day, ${name}`;

  marker.append(glyph, spoken);
  return marker;
}
