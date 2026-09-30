import {
  array,
  enum as enumOf,
  maxLength,
  object,
  pipe,
  refine,
  regex,
  safeParse,
  string,
  transform,
} from "zod/mini";
import type { ExportRequest } from "./export-request";

/**
 * An export request as the address of a page: what the dialog asks the
 * server for, and what the server asks its own browser to draw. One codec,
 * so the request that was previewed is the request that is printed.
 *
 * Every choice is spelled out rather than left to a default, so a request
 * read back from an address is exactly the one written to it, and a request
 * with a choice missing is refused rather than quietly filled in.
 *
 * Written against zod/mini, by name, and not the classic `z`. This module is
 * imported by the export dialog, so it is in the browser bundle, and the
 * classic namespace import carries every locale zod ships with it: some
 * 300 KB of other languages' error messages nobody here reads. The named
 * functions from zod/mini are the same validators without that weight.
 * The same rule holds for every other module the browser gets.
 */

const flag = pipe(
  enumOf(["1", "0"]),
  transform((value) => value === "1"),
);

/** A day's id as the trip gives it, and nothing that could be read as anything else. */
const dayId = string().check(regex(/^[A-Za-z0-9_-]{1,64}$/));

/**
 * Some days, or none when the cover alone is asked for, which is the whole
 * trip at a glance on the one page. Never neither, which is no page at all.
 */
const schema = object({
  days: pipe(
    pipe(
      string(),
      transform((value) => value.split(",").filter((id) => id !== "")),
    ),
    array(dayId).check(maxLength(60)),
  ),
  cover: flag,
  map: flag,
  mapSize: enumOf(["small", "medium", "large"]),
  notes: flag,
  legs: flag,
  addresses: flag,
  ruled: flag,
  hours: flag,
  stats: flag,
  paper: enumOf(["a4", "a5"]),
  orientation: enumOf(["portrait", "landscape"]),
  text: enumOf(["small", "medium", "large"]),
  ink: enumOf(["colour", "mono"]),
}).check(refine((request) => request.days.length > 0 || request.cover));

const onOff = (on: boolean): string => (on ? "1" : "0");

/** The request written into an address, ready to have anything else added. */
export function exportRequestQuery(request: ExportRequest): URLSearchParams {
  return new URLSearchParams({
    days: request.dayIds.join(","),
    cover: onOff(request.cover),
    map: onOff(request.map),
    mapSize: request.mapSize,
    notes: onOff(request.notes),
    legs: onOff(request.legs),
    addresses: onOff(request.addresses),
    ruled: onOff(request.ruled),
    hours: onOff(request.hours),
    stats: onOff(request.stats),
    paper: request.paper,
    orientation: request.orientation,
    text: request.text,
    ink: request.ink,
  });
}

/**
 * The request read back out of an address, or null when it is not one that
 * was written by the function above: a choice missing, or a value that is
 * not one of the choices.
 */
export function parseExportRequest(
  query: Readonly<Record<string, string | string[] | undefined>>,
): ExportRequest | null {
  const parsed = safeParse(schema, query);
  if (!parsed.success) {
    return null;
  }
  const { days, ...choices } = parsed.data;
  return { dayIds: days, ...choices };
}
