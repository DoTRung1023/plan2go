/**
 * Which rows go on which sheet, from how tall each one is.
 *
 * A day is a column of rows of uneven height, a stop with a note being
 * taller than one without, and a sheet holds so much of it. Rows are dealt
 * onto the first sheet until the next would not fit, then onto the next, and
 * so on, each sheet's room being what is left after the parts every sheet of
 * a day carries. A row taller than a whole sheet's room goes on a sheet of
 * its own and runs over it, since there is nothing else to do with it and a
 * row is never cut in two. A first sheet whose opening leaves no room for
 * even the first row, which small paper can do to the cover, keeps its
 * opening alone and hands the row to the next sheet, where it fits, rather
 * than growing past its page.
 */
export function paginate(
  /** Every row's height, in the order the day reads. */
  heights: readonly number[],
  /** The room on the first sheet, under the day's name, its numbers and its map. */
  firstRoom: number,
  /** The room on every sheet after it, under the name alone. */
  laterRoom: number,
): readonly (readonly number[])[] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    const room = pages.length === 0 ? firstRoom : laterRoom;
    const crowdedOpening =
      pages.length === 0 && page.length === 0 && height > firstRoom && height <= laterRoom;
    if ((page.length > 0 && used + height > room) || crowdedOpening) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(index);
    used += height;
  });
  if (page.length > 0 || pages.length === 0) {
    pages.push(page);
  }
  return pages;
}
