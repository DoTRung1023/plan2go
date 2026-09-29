import { describe, expect, it } from "vitest";
import { STATIC_MAP_SIZE } from "@/adapters/maps/static-map-frame";
import { mapSize, PAGE_MARGIN_MM, sheetGeometry } from "./paper";

describe("sheetGeometry", () => {
  it("gives A4 upright the design's margins, on the sheet itself", () => {
    const sheet = sheetGeometry("a4", "portrait");
    expect(sheet.widthPx).toBe(793);
    expect(sheet.heightPx).toBe(1123);
    expect(sheet.sidePaddingPx).toBe(56);
    expect(sheet.topPaddingPx).toBe(48);
    expect(sheet.bottomPaddingPx).toBe(32);
    expect(sheet.contentWidthPx).toBe(681);
    expect(sheet.roomPx).toBe(1031);
    expect(sheet.pageRoomMm).toBe(296);
    expect(sheet.pageSize).toBe("A4 portrait");
  });

  it("turns the paper on its side and keeps the margins", () => {
    const sheet = sheetGeometry("a4", "landscape");
    expect(sheet.widthPx).toBe(1122);
    expect(sheet.heightPx).toBe(794);
    expect(sheet.sidePaddingPx).toBe(56);
    expect(sheet.pageRoomMm).toBe(209);
    expect(sheet.pageSize).toBe("A4 landscape");
  });

  it("keeps A4's proportion of margin to page on smaller paper", () => {
    const sheet = sheetGeometry("a5", "portrait");
    expect(sheet.sidePaddingPx).toBe(39);
    expect(sheet.topPaddingPx).toBe(34);
    expect(sheet.bottomPaddingPx).toBe(23);
  });

  it("has no page margin, so the sheet's colour runs to the paper's edge", () => {
    expect(PAGE_MARGIN_MM).toBe(0);
  });

  it("never lays the rows out wider than the page prints them", () => {
    for (const paper of ["a4", "a5"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const sheet = sheetGeometry(paper, orientation);
        const widthMm = { a4: [210, 297], a5: [148, 210] }[paper][orientation === "portrait" ? 0 : 1];
        const printable = (widthMm ?? 0) * (96 / 25.4) - 2 * sheet.sidePaddingPx;
        expect(sheet.contentWidthPx).toBeLessThanOrEqual(printable);
        expect(sheet.contentWidthPx).toBeGreaterThan(printable - 1);
      }
    }
  });
});

describe("mapSize", () => {
  it("is as wide as the rows at its largest on paper standing up", () => {
    expect(mapSize(sheetGeometry("a4", "portrait"), "large")).toEqual({ width: 681, height: 230 });
  });

  it("keeps its shape at every size, each a step smaller than the last", () => {
    const sheet = sheetGeometry("a4", "portrait");
    const large = mapSize(sheet, "large");
    const medium = mapSize(sheet, "medium");
    const small = mapSize(sheet, "small");
    expect(small.width).toBeLessThan(medium.width);
    expect(medium.width).toBeLessThan(large.width);
    for (const size of [small, medium, large]) {
      expect(size.height).toBe(Math.round((size.width * STATIC_MAP_SIZE.height) / STATIC_MAP_SIZE.width));
    }
  });

  it("gives up width rather than the day on paper on its side", () => {
    const size = mapSize(sheetGeometry("a4", "landscape"), "large");
    expect(size.height).toBeLessThanOrEqual(Math.floor(sheetGeometry("a4", "landscape").roomPx * 0.42));
    expect(size.height).toBe(Math.round((size.width * STATIC_MAP_SIZE.height) / STATIC_MAP_SIZE.width));
  });
});
