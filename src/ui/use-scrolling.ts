import { useCallback } from "react";

/** How long after the last scroll event the content counts as still moving. */
const SETTLE_MS = 700;

/**
 * Marks an element with `data-scrolling` from its first scroll event until
 * none has arrived for a moment, for a scrollbar that shows itself while the
 * content moves and goes away once it has settled. The pointer finds a bar by
 * hovering; a thumb has nothing to hover with, and the movement is what it
 * gets instead.
 *
 * Written straight onto the element rather than through state, so a strip
 * being swiped does not render its owner on every frame. Given to `ref`; the
 * listener is taken off again when the element goes.
 */
export function useScrolling(): (element: HTMLElement | null) => (() => void) | undefined {
  return useCallback((element: HTMLElement | null) => {
    if (element === null) {
      return undefined;
    }
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (): void => {
      element.dataset["scrolling"] = "";
      if (settle !== null) {
        clearTimeout(settle);
      }
      settle = setTimeout(() => {
        delete element.dataset["scrolling"];
        settle = null;
      }, SETTLE_MS);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      if (settle !== null) {
        clearTimeout(settle);
      }
    };
  }, []);
}
