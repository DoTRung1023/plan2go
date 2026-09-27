import { outsidePressIsTaken } from "@/ui/use-outside-press";
import { isOnMarker } from "./dom-marker";

/**
 * How long a press on the map is held before it counts as one, in
 * milliseconds: long enough for the second press of a double press, which
 * zooms, to arrive and call it off. A little over the quarter second map
 * libraries give a single press, since a double press made with care is
 * slower than one made in a hurry.
 */
const SINGLE_PRESS_MS = 300;

/**
 * Calls `onPress` each time the map is pressed as the reader means it: once,
 * on the ground or on a route, and for nothing else. Answers the way to stop
 * listening.
 *
 * Not on a marker, which is the marker's press. Not the first half of a
 * double press, which zooms: Google says click for each press of a double
 * press before it says dblclick, so a press is held for as long as a second
 * could follow it, and let go if one does. And not a press spent putting a
 * panel away: pressing beside an open menu or picker is how it is closed,
 * and the same press closing something on the map too closed something the
 * reader was still using. That is asked as the press begins, on its way down
 * through `element`, the box the map is drawn in, before the panel has heard
 * the press and gone.
 *
 * A route's line takes its own presses, so the line hands them to the map
 * as clicks and dblclicks of the map's own, and they arrive here.
 */
export function listenForPresses(
  map: google.maps.Map,
  element: HTMLElement,
  onPress: () => void,
): () => void {
  let spent = false;
  let held: ReturnType<typeof setTimeout> | null = null;
  const letGo = (): void => {
    if (held !== null) {
      clearTimeout(held);
      held = null;
    }
  };
  const pressStarted = (): void => {
    spent = outsidePressIsTaken();
  };

  element.addEventListener("pointerdown", pressStarted, { capture: true });
  const click = map.addListener("click", ({ domEvent }: google.maps.MapMouseEvent) => {
    if (isOnMarker(domEvent.target)) {
      return;
    }
    letGo();
    if (spent || (domEvent instanceof UIEvent && domEvent.detail > 1)) {
      return;
    }
    held = setTimeout(() => {
      held = null;
      onPress();
    }, SINGLE_PRESS_MS);
  });
  const doubled = map.addListener("dblclick", letGo);

  return () => {
    letGo();
    element.removeEventListener("pointerdown", pressStarted, { capture: true });
    click.remove();
    doubled.remove();
  };
}
