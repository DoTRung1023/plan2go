/**
 * A stop carried by a finger.
 *
 * The browser's own drag is how a pointer moves a stop, and most phones do not
 * have one: a finger on the grip did nothing at all. So on a touch screen the
 * grip carries the card itself, and this is the arithmetic of that: which card
 * the finger is over, and how fast what the day scrolls in should run on under
 * a finger held near its edge, so a stop can be carried further than the
 * window shows.
 *
 * Positions are measured once, when the card is picked up, in the scrolling
 * box's own terms: the distance down its content rather than down the window,
 * so a measure taken before a scroll still holds after it. Nothing on the day
 * moves while a card is carried, only the card.
 */

/** Where one card is, top and bottom, down the content of what scrolls. */
export interface CardSpan {
  readonly index: number;
  readonly top: number;
  readonly bottom: number;
}

/** How far a finger goes before a press on the grip becomes a carry. */
export const CARRY_SLOP = 6;

/** How near an edge a finger has to be before the day runs on under it. */
const EDGE = 56;

/** The most the day runs on in one frame, with the finger at the very edge. */
const FASTEST = 14;

/**
 * The card a finger this far down is over. Between two cards, which is where a
 * leg is, it stays on the one it was last over, so the target does not flicker
 * as the finger crosses the gap; above the first card it is the first, and
 * below the last it is the last, so a stop can be carried to either end
 * without landing exactly on the end card.
 */
export function cardUnder(y: number, cards: readonly CardSpan[], last: number): number {
  const first = cards[0];
  const final = cards[cards.length - 1];
  if (first === undefined || final === undefined) {
    return last;
  }
  if (y < first.top) {
    return first.index;
  }
  if (y > final.bottom) {
    return final.index;
  }
  return cards.find((card) => y >= card.top && y <= card.bottom)?.index ?? last;
}

/**
 * How far to scroll this frame with the finger at y, between the top and the
 * bottom of what can be seen of the day: nothing in the middle, and faster
 * the nearer the edge, back up towards the top and on down towards the foot.
 * Whole pixels, since a scroll position is one.
 */
export function edgeScroll(y: number, top: number, bottom: number): number {
  if (y < top + EDGE) {
    return -Math.round(FASTEST * Math.min(1, (top + EDGE - y) / EDGE));
  }
  if (y > bottom - EDGE) {
    return Math.round(FASTEST * Math.min(1, (y - (bottom - EDGE)) / EDGE));
  }
  return 0;
}

/**
 * What the day scrolls in: its own box, where the list scrolls under the
 * trip's name, and the window when nothing does. A box counts only while it
 * actually has more in it than it shows.
 */
export function scrollerOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null && node !== document.body; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/** How far what the day scrolls in has been scrolled, null being the window. */
export function scrolledBy(scroller: HTMLElement | null): number {
  return scroller === null ? window.scrollY : scroller.scrollTop;
}

/** Scrolls what the day is in on by so many pixels, null being the window. */
export function scrollOn(scroller: HTMLElement | null, by: number): void {
  if (scroller === null) {
    window.scrollBy(0, by);
  } else {
    scroller.scrollTop += by;
  }
}

/**
 * The part of the window the day can be seen in, top and bottom: the box it
 * scrolls in, or the whole window when the day is short enough not to.
 */
export function visibleBand(scroller: HTMLElement | null): { readonly top: number; readonly bottom: number } {
  if (scroller !== null) {
    const box = scroller.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }
  return { top: 0, bottom: window.innerHeight };
}

/**
 * Every card on the day, measured down the content of what it scrolls in. The
 * cards are the elements marked with their place in the day, beside the one
 * being picked up.
 */
export function spansBeside(card: HTMLElement, scroller: HTMLElement | null): readonly CardSpan[] {
  const list = card.parentElement;
  if (list === null) {
    return [];
  }
  const scrolled = scrolledBy(scroller);
  return Array.from(list.querySelectorAll<HTMLElement>("[data-stop-index]"), (element) => {
    const box = element.getBoundingClientRect();
    return {
      index: Number(element.dataset.stopIndex),
      top: box.top + scrolled,
      bottom: box.bottom + scrolled,
    };
  });
}
