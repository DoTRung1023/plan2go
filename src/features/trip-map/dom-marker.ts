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

/**
 * Somewhere the day goes through. The shape the panel gives it and the shape
 * the day's own ends have: olive, cornered, and holding a pin rather than a
 * number, because a checkpoint is not one of the numbers the day counts off.
 */
export function checkpointMarkerElement(name: string): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-checkpoint";

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

  const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  outline.setAttribute("d", "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z");
  const eye = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  eye.setAttribute("cx", "12");
  eye.setAttribute("cy", "10");
  eye.setAttribute("r", "2.6");
  glyph.append(outline, eye);

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `Checkpoint, ${name}`;

  marker.append(glyph, spoken);
  return marker;
}

/** Sized by its own padding, since it may say Start, End, or both. */
export function endpointMarkerElement(word: string, name: string): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "trip-map-marker trip-map-endpoint";

  const shown = document.createElement("span");
  shown.setAttribute("aria-hidden", "true");
  shown.textContent = word;

  const spoken = document.createElement("span");
  spoken.className = "trip-map-name";
  spoken.textContent = `${word} of the day, ${name}`;

  marker.append(shown, spoken);
  return marker;
}
