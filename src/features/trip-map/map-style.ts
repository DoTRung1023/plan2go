/**
 * The paper palette, handed to Google as a style array.
 *
 * The values are read from the CSS custom properties rather than written again
 * here, because DESIGN.md and the @theme block in globals.css are already two
 * copies of the palette and a third would be the one that goes stale.
 */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Warm paper under warm ink. Water is the strong rule tone rather than a blue,
 * because this product has one accent and no second hue. Cartographic icons are
 * off: the printed guide look carries places by name, and the markers for the
 * day have the map to themselves.
 */
export function paperMapStyle(): google.maps.MapTypeStyle[] {
  const paper = token("--color-paper");
  const paperRaised = token("--color-paper-raised");
  const paperSunken = token("--color-paper-sunken");
  const rule = token("--color-rule");
  const ruleStrong = token("--color-rule-strong");
  const ink = token("--color-ink");
  const inkMuted = token("--color-ink-muted");
  const inkFaint = token("--color-ink-faint");

  return [
    { elementType: "geometry", stylers: [{ color: paper }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: ink }] },
    { elementType: "labels.text.stroke", stylers: [{ color: paper }] },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: ruleStrong }],
    },
    {
      featureType: "administrative.land_parcel",
      stylers: [{ visibility: "off" }],
    },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: paperSunken }] },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: inkFaint }],
    },
    { featureType: "road", elementType: "geometry", stylers: [{ color: paperRaised }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: rule }] },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: inkMuted }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: ruleStrong }],
    },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: rule }] },
    {
      featureType: "transit",
      elementType: "labels.text.fill",
      stylers: [{ color: inkFaint }],
    },
    { featureType: "water", elementType: "geometry", stylers: [{ color: rule }] },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: inkFaint }],
    },
  ];
}
