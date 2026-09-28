/**
 * The city colours, in the order they are handed out, as the stylesheet's
 * own tokens. The slot a city holds is an index into this list, and the
 * list is the only place a component learns what a slot looks like.
 */
const CITY_COLORS = [
  "var(--color-city-1)",
  "var(--color-city-2)",
  "var(--color-city-3)",
  "var(--color-city-4)",
  "var(--color-city-5)",
  "var(--color-city-6)",
] as const;

/** What the colour in a slot is, going round again past the last. */
export function cityColor(slot: number): string {
  return CITY_COLORS[slot % CITY_COLORS.length] ?? CITY_COLORS[0];
}

interface CityDotProps {
  /** Which of the city colours, as the trip handed it out. */
  readonly slot: number;
  /** Edge of the dot, in pixels. */
  readonly size: number;
}

/**
 * Which city something is in, as a dot of that city's colour. Decorative:
 * whatever carries the dot says the city in words for a reader who cannot
 * see it. Always drawn on paper, so always in its own colour. It turns over
 * 200ms when what it stands for changes to another city, with the city's
 * name beside it.
 */
export function CityDot({ slot, size }: CityDotProps) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-pill transition-[background-color] duration-200 ease-out motion-reduce:transition-none"
      style={{
        width: size,
        height: size,
        backgroundColor: cityColor(slot),
      }}
    />
  );
}
