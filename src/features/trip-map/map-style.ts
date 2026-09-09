/**
 * The warm palette, handed to Google as a style array.
 *
 * The values are read from the CSS custom properties rather than written again
 * here, because DESIGN.md and the @theme block in globals.css are already two
 * copies of the palette and a third would be the one that goes stale. Only the
 * opaque tokens are read: Google's styler takes a colour, not a color-mix, so
 * the translucent rules and inks are taken from the neutral ramp instead, which
 * is the same value at the same weight.
 */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Warm cream under warm ink. Water is a deeper step of the same warm ramp
 * rather than a blue, because this product has two accents and neither of them
 * is one. Cartographic icons are off: the day's own markers have the map to
 * themselves, and the stops are listed by name beside it.
 */
export function paperMapStyle(): google.maps.MapTypeStyle[] {
  const paper = token("--color-paper");
  const paperRaised = token("--color-paper-raised");
  const paperSunken = token("--color-paper-sunken");
  const rule = token("--color-neutral-300");
  const ruleStrong = token("--color-neutral-400");
  const ink = token("--color-ink");
  const inkMuted = token("--color-neutral-700");
  const inkFaint = token("--color-neutral-600");

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
