import { useCallback } from "react";

/** How long after the last scroll event the content counts as still moving. */
const SETTLE_MS = 700;

/** The thumb never shrinks past this, or a long day has a bar too short to see. */
const MIN_THUMB = 16;

/** The strip along the edge that a press counts as a press on the bar, at least. */
const MIN_GRIP = 8;

export type ScrollAxis = "x" | "y";

interface ScrollBarOptions {
  /**
   * How far in from either end of the box the thumb's track stops. Four by
   * default, as breathing room; more for a box with rounded corners, which
   * would clip a thumb that ran into them.
   */
  readonly inset?: number;
}

/** Where the thumb is, for a box whose content is longer than the box. */
interface Thumb {
  /** How much of the content the box shows, along the axis. */
  readonly visible: number;
  /** All of the content, along the axis. */
  readonly total: number;
  /** The run the thumb can travel, the box less the inset at each end. */
  readonly track: number;
  readonly size: number;
  readonly start: number;
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
 * The line can be taken hold of, the way the browser's could: a press on the
 * thumb drags it, and a press on the track beside it brings the thumb there
 * and drags from there. Only with a mouse or a pen; a finger scrolls the box
 * itself, and a finger at the edge is not reaching for a two pixel line.
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

      const thumb = (): Thumb | null => {
        const visible = axis === "y" ? element.clientHeight : element.clientWidth;
        const total = axis === "y" ? element.scrollHeight : element.scrollWidth;
        const offset = axis === "y" ? element.scrollTop : element.scrollLeft;
        if (total <= visible) {
          return null;
        }
        const track = visible - inset * 2;
        const size = Math.max(MIN_THUMB, (track * visible) / total);
        const start = inset + ((track - size) * offset) / (total - visible);
        return { visible, total, track, size, start };
      };

      const measure = (): void => {
        const at = thumb();
        if (at === null) {
          element.style.setProperty("--bar-size", "0px");
          return;
        }
        element.style.setProperty("--bar-start", `${String(Math.round(at.start))}px`);
        element.style.setProperty("--bar-size", `${String(Math.round(at.size))}px`);
      };

      /** Scroll so that the thumb starts here. The browser clamps the ends. */
      const bringTo = (at: Thumb, start: number): void => {
        const offset = ((start - inset) * (at.total - at.visible)) / (at.track - at.size);
        if (axis === "y") {
          element.scrollTop = offset;
        } else {
          element.scrollLeft = offset;
        }
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

      /** Where the pointer is along the axis, from the box's edge, and whether it is on the bar. */
      const locate = (event: PointerEvent): { along: number; onBar: boolean } => {
        const rect = element.getBoundingClientRect();
        const width = parseFloat(getComputedStyle(element).getPropertyValue("--bar-w")) || 2;
        const grip = Math.max(MIN_GRIP, width * 2);
        return axis === "y"
          ? { along: event.clientY - rect.top, onBar: event.clientX >= rect.right - grip }
          : { along: event.clientX - rect.left, onBar: event.clientY >= rect.bottom - grip };
      };

      /** The press being followed: the thumb's start, and where the pointer was, when it began. */
      let held: { readonly thumbStart: number; readonly pointer: number } | null = null;

      const onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "touch" || event.button !== 0) {
          return;
        }
        const at = thumb();
        if (at === null) {
          return;
        }
        const { along, onBar } = locate(event);
        if (!onBar) {
          return;
        }
        event.preventDefault();
        const onThumb = along >= at.start && along <= at.start + at.size;
        const thumbStart = onThumb ? at.start : along - at.size / 2;
        if (!onThumb) {
          bringTo(at, thumbStart);
        }
        held = { thumbStart, pointer: along };
        element.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (held === null) {
          return;
        }
        const at = thumb();
        if (at === null) {
          return;
        }
        bringTo(at, held.thumbStart + (locate(event).along - held.pointer));
      };

      const onPointerUp = (event: PointerEvent): void => {
        if (held === null) {
          return;
        }
        held = null;
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
      };

      const resized = new ResizeObserver(measure);
      resized.observe(element);
      element.addEventListener("scroll", onScroll, { passive: true });
      element.addEventListener("pointerenter", measure);
      element.addEventListener("pointerdown", onPointerDown);
      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", onPointerUp);
      element.addEventListener("pointercancel", onPointerUp);
      measure();

      return () => {
        resized.disconnect();
        element.removeEventListener("scroll", onScroll);
        element.removeEventListener("pointerenter", measure);
        element.removeEventListener("pointerdown", onPointerDown);
        element.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("pointerup", onPointerUp);
        element.removeEventListener("pointercancel", onPointerUp);
        if (settle !== null) {
          clearTimeout(settle);
        }
      };
    },
    [axis, inset],
  );
}
