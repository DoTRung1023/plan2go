import { describe, expect, it } from "vitest";
import { mapSize, sheetGeometry } from "./paper";

describe("sheetGeometry", () => {
  it("draws A4 upright as the sheet always was", () => {
    const sheet = sheetGeometry("a4", "portrait");
    expect(sheet.widthPx).toBe(794);
    expect(sheet.heightPx).toBe(1123);
    expect(sheet.sidePaddingPx).toBe(61);
    expect(sheet.topPaddingPx).toBe(60);
    expect(sheet.contentWidthPx).toBe(672);
    expect(sheet.roomPx).toBe(991);
    expect(sheet.pageRoomMm).toBe(264);
    expect(sheet.pageSize).toBe("A4 portrait");
  });

  it("turns the paper on its side", () => {
    const sheet = sheetGeometry("a4", "landscape");
    expect(sheet.widthPx).toBe(1123);
    expect(sheet.heightPx).toBe(794);
    expect(sheet.pageRoomMm).toBe(177);
    expect(sheet.pageSize).toBe("A4 landscape");
  });

  it("never lays the rows out wider than the page prints them", () => {
    for (const paper of ["a4", "a5"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const sheet = sheetGeometry(paper, orientation);
        const widthMm = { a4: [210, 297], a5: [148, 210] }[paper][orientation === "portrait" ? 0 : 1];
        const printable = ((widthMm ?? 0) - 32) * (96 / 25.4);
        expect(sheet.contentWidthPx).toBeLessThanOrEqual(printable);
        expect(sheet.contentWidthPx).toBeGreaterThan(printable - 3);
      }
    }
  });
});

describe("mapSize", () => {
  it("is as wide as the rows on paper standing up", () => {
    expect(mapSize(sheetGeometry("a4", "portrait"))).toEqual({ width: 672, height: 336 });
  });

  it("gives up width rather than the day on paper on its side", () => {
    const size = mapSize(sheetGeometry("a4", "landscape"));
    expect(size.height).toBeLessThanOrEqual(Math.floor(sheetGeometry("a4", "landscape").roomPx * 0.42));
    expect(size.width).toBe(size.height * 2);
  });
});
