/**
 * The paper the sheets are made for, and how big a sheet of it is on screen.
 *
 * A sheet is drawn at the paper's size at screen resolution, 96 pixels to
 * the inch, with its margins as its own padding, so the rows are laid out at
 * the width they print and what fits a sheet here fits the page. The print
 * window is told the same size and way up, so the browser never has to
 * shrink or turn anything.
 */
import { STATIC_MAP_SIZE } from "@/adapters/maps/static-map-frame";

export type PaperSize = "a4" | "a5";
export type Orientation = "portrait" | "landscape";
export type TextSize = "small" | "medium" | "large";
export type Ink = "colour" | "mono";
export type MapSize = "small" | "medium" | "large";

/** The two sides of each paper, in millimetres. */
const SIDES_MM: Readonly<Record<PaperSize, { readonly short: number; readonly long: number }>> = {
  a4: { short: 210, long: 297 },
  a5: { short: 148, long: 210 },
};

/**
 * The page has no margin of its own. A sheet carries its margins as its own
 * padding, on the colour it is drawn on, so that colour runs to the paper's
 * edge rather than stopping at a frame the page rule would leave blank. Told
 * to the browser that draws the PDF as well.
 */
export const PAGE_MARGIN_MM = 0;

/**
 * A sheet's margins on A4, in pixels, from the design for the printed trip:
 * more room over the page than under it, where the foot sits.
 */
const A4_MARGINS_PX = { top: 48, side: 56, bottom: 32 } as const;

/** The short side of A4, which another paper's margins are scaled from. */
const A4_SHORT_MM = 210;

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
  readonly bottomPaddingPx: number;
  /** What the rows are laid out at: the paper less its margins, never wider than the page prints. */
  readonly contentWidthPx: number;
  /** The height the rows are dealt to. */
  readonly roomPx: number;
  /** The printed sheet's height: the page's, a hair under, so rounding never adds a page. */
  readonly pageRoomMm: number;
  /** What the page rule is told: "A4 portrait", "A5 landscape". */
  readonly pageSize: string;
}

export function sheetGeometry(paper: PaperSize, orientation: Orientation): SheetGeometry {
  const { short, long } = SIDES_MM[paper];
  const widthMm = orientation === "portrait" ? short : long;
  const heightMm = orientation === "portrait" ? long : short;
  // Smaller paper keeps the same proportions of margin to page as A4 does.
  const scale = short / A4_SHORT_MM;
  const sidePaddingPx = Math.round(A4_MARGINS_PX.side * scale);
  const topPaddingPx = Math.round(A4_MARGINS_PX.top * scale);
  const bottomPaddingPx = Math.round(A4_MARGINS_PX.bottom * scale);
  // Rounded down, so the rows here are never wider than the page's and a
  // line that fits on screen fits on paper; the sheet on screen is that
  // and its margins, which is at most a pixel short of the paper.
  const contentWidthPx = Math.floor(widthMm * PX_PER_MM - 2 * sidePaddingPx);
  const heightPx = Math.round(heightMm * PX_PER_MM);
  return {
    widthPx: contentWidthPx + 2 * sidePaddingPx,
    heightPx,
    sidePaddingPx,
    topPaddingPx,
    bottomPaddingPx,
    contentWidthPx,
    roomPx: heightPx - topPaddingPx - bottomPaddingPx - SLACK_PX,
    pageRoomMm: heightMm - 1,
    pageSize: `${paper.toUpperCase()} ${orientation}`,
  };
}

/** The map's own shape, wide over high, which the picture is drawn in. */
const MAP_SHAPE = STATIC_MAP_SIZE.width / STATIC_MAP_SIZE.height;

/** How much of the rows' width the map takes at each size. */
const MAP_SHARE: Readonly<Record<MapSize, number>> = { small: 0.5, medium: 0.72, large: 1 };

/**
 * How big the map at the top of a day is drawn: in the picture's own shape,
 * and at its largest as wide as the rows, unless that would take more of the
 * sheet than a picture should, which it would on paper turned on its side;
 * then as tall as that share allows, and as wide as its shape makes it.
 */
export function mapSize(
  geometry: SheetGeometry,
  size: MapSize,
): { readonly width: number; readonly height: number } {
  const tallest = Math.floor(geometry.roomPx * 0.42);
  const width = Math.min(
    Math.round(geometry.contentWidthPx * MAP_SHARE[size]),
    Math.floor(tallest * MAP_SHAPE),
  );
  return { width, height: Math.round(width / MAP_SHAPE) };
}
