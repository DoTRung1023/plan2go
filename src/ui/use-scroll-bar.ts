import { useCallback } from "react";

/** How long after the last scroll event the content counts as still moving. */
const SETTLE_MS = 700;

/** The thumb never shrinks past this, or a long day has a bar too short to see. */
const MIN_THUMB = 16;

export type ScrollAxis = "x" | "y";

interface ScrollBarOptions {
  /**
   * How far in from either end of the box the thumb's track stops. Four by
   * default, as breathing room; more for a box with rounded corners, which
   * would clip a thumb that ran into them.
   */
  readonly inset?: number;
}

/**
 * Draws the box's scrollbar itself, as a line along its edge, and marks the
 * box while its content is moving.
 *
 * Every browser draws its own bar its own way, and Firefox will draw none
 * thinner than its idea of thin. So the box hides the browser's (scroll-line
 * in globals.css) and this measures where the content is and writes it into
 * the two custom properties that utility paints from: how far along the edge
 * the thumb starts, and how long it is. Measured when the content moves, when
 * the pointer arrives, and when the box changes size, which between them are
 * every moment the bar could be seen.
 *
 * `data-scrolling` is set from the first scroll event until none has arrived
 * for a moment, for a bar that shows itself while the content moves and goes
 * away once it has settled: the pointer finds a bar by hovering, and a thumb
 * has nothing to hover with.
 *
 * Written straight onto the element rather than through state, so a box being
 * swiped does not render its owner on every frame. Given to `ref`; everything
 * is taken off again when the element goes.
 */
export function useScrollBar(
  axis: ScrollAxis,
  { inset = 4 }: ScrollBarOptions = {},
): (element: HTMLElement | null) => (() => void) | undefined {
  return useCallback(
    (element: HTMLElement | null) => {
      if (element === null) {
        return undefined;
      }
      element.dataset["axis"] = axis;

      const measure = (): void => {
        const visible = axis === "y" ? element.clientHeight : element.clientWidth;
        const total = axis === "y" ? element.scrollHeight : element.scrollWidth;
        const offset = axis === "y" ? element.scrollTop : element.scrollLeft;
        if (total <= visible) {
          element.style.setProperty("--bar-size", "0px");
          return;
        }
        const track = visible - inset * 2;
        const size = Math.max(MIN_THUMB, (track * visible) / total);
        const start = inset + ((track - size) * offset) / (total - visible);
        element.style.setProperty("--bar-start", `${String(Math.round(start))}px`);
        element.style.setProperty("--bar-size", `${String(Math.round(size))}px`);
      };

      let settle: ReturnType<typeof setTimeout> | null = null;
      const onScroll = (): void => {
        measure();
        element.dataset["scrolling"] = "";
        if (settle !== null) {
          clearTimeout(settle);
        }
        settle = setTimeout(() => {
          delete element.dataset["scrolling"];
          settle = null;
        }, SETTLE_MS);
      };

      const resized = new ResizeObserver(measure);
      resized.observe(element);
      element.addEventListener("scroll", onScroll, { passive: true });
      element.addEventListener("pointerenter", measure);
      measure();

      return () => {
        resized.disconnect();
        element.removeEventListener("scroll", onScroll);
        element.removeEventListener("pointerenter", measure);
        if (settle !== null) {
          clearTimeout(settle);
        }
      };
    },
    [axis, inset],
  );
}
