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

/** Which end of the day a marker stands for, or both where they are one place. */
export type EndpointKind = "start" | "end" | "both";

/**
 * The same glyphs the panel draws, so a place is one shape wherever it is: a
 * house where the day sets out from, a flag where it finishes. One place that
 * is both gets the house, because there and back is what a house says.
 */
const ENDPOINT_MARKS: Readonly<
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

/** An end of the day. Which end decides the glyph and what is read out. */
export function endpointMarkerElement(kind: EndpointKind, name: string): HTMLElement {
  const mark = ENDPOINT_MARKS[kind];
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-endpoint";

  const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  glyph.setAttribute("aria-hidden", "true");
  glyph.setAttribute("viewBox", "0 0 24 24");
  glyph.setAttribute("width", "15");
  glyph.setAttribute("height", "15");
  glyph.setAttribute("fill", "none");
  glyph.setAttribute("stroke", "currentColor");
  glyph.setAttribute("stroke-width", "2.75");
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
