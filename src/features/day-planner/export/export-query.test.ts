import { describe, expect, it } from "vitest";
import { exportRequestQuery, parseExportRequest } from "./export-query";
import { DEFAULT_EXPORT } from "./export-request";
import type { ExportRequest } from "./export-request";

const request: ExportRequest = {
  ...DEFAULT_EXPORT,
  dayIds: ["cm1abc", "cm1def"],
  cover: true,
  mapSize: "small",
  paper: "a5",
  orientation: "landscape",
  ink: "mono",
};

function fromQuery(query: URLSearchParams): Record<string, string> {
  return Object.fromEntries(query);
}

describe("exportRequestQuery", () => {
  it("reads back as the request it was written from", () => {
    expect(parseExportRequest(fromQuery(exportRequestQuery(request)))).toEqual(request);
  });

  it("keeps the days in the order they were given", () => {
    const query = exportRequestQuery({ ...request, dayIds: ["b", "a", "c"] });
    expect(parseExportRequest(fromQuery(query))?.dayIds).toEqual(["b", "a", "c"]);
  });

  it("spells out every choice, so nothing is left to a default", () => {
    const query = exportRequestQuery(request);
    for (const key of Object.keys(DEFAULT_EXPORT)) {
      expect(query.has(key), key).toBe(true);
    }
  });
});

describe("parseExportRequest", () => {
  it("refuses an address with a choice missing", () => {
    const query = fromQuery(exportRequestQuery(request));
    delete query["paper"];
    expect(parseExportRequest(query)).toBeNull();
  });

  it("refuses a value that is not one of the choices", () => {
    const query = { ...fromQuery(exportRequestQuery(request)), paper: "letter" };
    expect(parseExportRequest(query)).toBeNull();
  });

  it("reads the cover alone, with no days, as the trip at a glance", () => {
    const coverOnly = { ...request, dayIds: [], cover: true };
    expect(parseExportRequest(fromQuery(exportRequestQuery(coverOnly)))).toEqual(coverOnly);
  });

  it("refuses no days and no cover, which is no page at all", () => {
    const query = { ...fromQuery(exportRequestQuery(request)), days: "", cover: "0" };
    expect(parseExportRequest(query)).toBeNull();
  });

  it("refuses a day id that is not one the trip could have given", () => {
    const query = { ...fromQuery(exportRequestQuery(request)), days: "cm1abc,../etc" };
    expect(parseExportRequest(query)).toBeNull();
  });

  it("refuses a choice given twice", () => {
    const query = { ...fromQuery(exportRequestQuery(request)), ink: ["mono", "colour"] };
    expect(parseExportRequest(query)).toBeNull();
  });
});
