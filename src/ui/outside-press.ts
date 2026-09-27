/**
 * A panel that closes when anything outside it is pressed: a menu, a picker,
 * the results under a search field. Spread onto the panel, which is on the
 * page only while it is open, so the mark is there exactly as long as the
 * panel is.
 *
 * It is how something else that answers a press can tell the press was for
 * the panel. Pressing beside an open menu is how a menu is put away, and a
 * press that did that and then closed a second thing as well closed
 * something the reader was still using.
 */
export const closesOnOutsidePress = { "data-closes-on-outside-press": "" } as const;

/**
 * Whether a panel that closes on a press outside it is open. Asked as the
 * press begins, since by the time it has finished the panel has heard it and
 * gone.
 */
export function outsidePressIsTaken(): boolean {
  return document.querySelector("[data-closes-on-outside-press]") !== null;
}
