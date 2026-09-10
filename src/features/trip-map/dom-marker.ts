/**
 * A marker that is our own DOM rather than Google's.
 *
 * DESIGN.md is specific about these: a stop is a numbered disc with a 2px
 * terracotta ring, an endpoint is a different shape in olive, and both carry a
 * name that is read out but never drawn. Google's own markers take an image, so
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

/** Sized by its own padding, since it may say Start, End, or both. */
export function endpointMarkerElement(word: string, name: string): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-endpoint";

  // The same house the panel draws, so a place is one shape wherever it is.
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

  const roof = document.createElementNS("http://www.w3.org/2000/svg", "path");
  roof.setAttribute("d", "m3 10 9-7 9 7v10a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z");
  const door = document.createElementNS("http://www.w3.org/2000/svg", "path");
  door.setAttribute("d", "M9.5 21.5v-7h5v7");
  glyph.append(roof, door);

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `${word} of the day, ${name}`;

  marker.append(glyph, spoken);
  return marker;
}
