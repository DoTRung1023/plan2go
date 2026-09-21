/**
 * The paper the sheets are made for, and how big a sheet of it is on screen.
 *
 * A sheet is drawn at the paper's size at screen resolution, 96 pixels to
 * the inch, with the margins the page rule keeps on every side, so the rows
 * are laid out at the width they print and what fits a sheet here fits the
 * page. The print window is told the same size and way up, so the browser
 * never has to shrink or turn anything.
 */
export type PaperSize = "a4" | "a5";
export type Orientation = "portrait" | "landscape";
export type TextSize = "small" | "medium" | "large";
export type Ink = "colour" | "mono";

/** The two sides of each paper, in millimetres. */
const SIDES_MM: Readonly<Record<PaperSize, { readonly short: number; readonly long: number }>> = {
  a4: { short: 210, long: 297 },
  a5: { short: 148, long: 210 },
};

/** What the page rule keeps clear on every side. */
export const MARGIN_MM = 16;

const PX_PER_MM = 96 / 25.4;

/**
 * A little under the room a sheet has, so that a page dealt to the pixel
 * here never spills its last row onto a blank page there.
 */
const SLACK_PX = 12;

export interface SheetGeometry {
  /** The paper, at screen resolution. */
  readonly widthPx: number;
  readonly heightPx: number;
  /** The margins, as the sheet's own padding. */
  readonly sidePaddingPx: number;
  readonly topPaddingPx: number;
  /** What the rows are laid out at: the paper less its margins, never wider than the page prints. */
  readonly contentWidthPx: number;
  /** The height the rows are dealt to. */
  readonly roomPx: number;
  /** The page less its margins, for the printed sheet's height, a hair under so rounding never adds a page. */
  readonly pageRoomMm: number;
  /** What the page rule is told: "A4 portrait", "A5 landscape". */
  readonly pageSize: string;
}

export function sheetGeometry(paper: PaperSize, orientation: Orientation): SheetGeometry {
  const { short, long } = SIDES_MM[paper];
  const widthMm = orientation === "portrait" ? short : long;
  const heightMm = orientation === "portrait" ? long : short;
  const widthPx = Math.round(widthMm * PX_PER_MM);
  const heightPx = Math.round(heightMm * PX_PER_MM);
  // Rounded down, so the rows here are never wider than the page's and a
  // line that fits on screen fits on paper.
  const printable = Math.floor((widthMm - 2 * MARGIN_MM) * PX_PER_MM);
  const sidePaddingPx = Math.round((widthPx - printable) / 2);
  const topPaddingPx = Math.round(MARGIN_MM * PX_PER_MM);
  return {
    widthPx,
    heightPx,
    sidePaddingPx,
    topPaddingPx,
    contentWidthPx: widthPx - 2 * sidePaddingPx,
    roomPx: heightPx - 2 * topPaddingPx - SLACK_PX,
    pageRoomMm: heightMm - 2 * MARGIN_MM - 1,
    pageSize: `${paper.toUpperCase()} ${orientation}`,
  };
}

/**
 * How big the map at the top of a day is drawn: as wide as the rows, two
 * wide by one high, unless that would take more of the sheet than a picture
 * should, which it would on paper turned on its side; then as tall as that
 * share allows, and as wide as its shape makes it.
 */
export function mapSize(geometry: SheetGeometry): { readonly width: number; readonly height: number } {
  const tallest = Math.floor(geometry.roomPx * 0.42);
  const width = Math.min(geometry.contentWidthPx, tallest * 2);
  return { width, height: Math.round(width / 2) };
}
