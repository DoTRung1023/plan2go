import type { RefObject } from "react";
import { useEffect, useRef } from "react";

/** How many panels that close on a press outside them are open now. */
let openPanels = 0;

/**
 * Closes a panel when anything outside it is pressed: a menu, a picker, the
 * results under a search field. `container` is everything that counts as
 * inside it, the button that opened the panel as well as the panel, so a
 * press on that button is left to the button.
 *
 * The press is the mouse going down, not the click it ends in, so the panel
 * is already going as whatever was pressed starts to answer. Handed the
 * newest `onOutside` each render, since closing often writes down whatever
 * was chosen in the panel, and that changes as the reader chooses.
 *
 * An open panel is counted as well, which is how something else that answers
 * a press can tell the press was the panel's: pressing beside an open menu is
 * how a menu is put away, and a press that did that and then closed a second
 * thing too closed something the reader was still using.
 */
export function useOutsidePress(
  container: RefObject<HTMLElement | null>,
  open: boolean,
  onOutside: () => void,
): void {
  const latest = useRef(onOutside);
  useEffect(() => {
    latest.current = onOutside;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    openPanels += 1;
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      if (target instanceof Node && container.current?.contains(target) === true) {
        return;
      }
      latest.current();
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      openPanels -= 1;
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open, container]);
}

/**
 * Whether a panel that closes on a press outside it is open. Asked as a press
 * begins, before the mouse has gone down, since by then the panel has heard
 * it and gone.
 */
export function outsidePressIsTaken(): boolean {
  return openPanels > 0;
}
