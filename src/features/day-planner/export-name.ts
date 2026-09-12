/**
 * What the browser should call the file.
 *
 * The print window takes its suggested name from the document's title, which
 * on every page of this product is "plan2go", so a trip saved as a PDF landed
 * in the downloads folder called plan2go.pdf, and the next one plan2go (1).
 * The name a person wants is the trip, and which of its days are in the file.
 *
 * Days are numbered the way the trip numbers them rather than the way this
 * file counts them, so Day 3 in the downloads folder is Day 3 in the planner.
 */

/** More than this many separate days and the name says how many rather than which. */
const NAMED_AT_MOST = 3;

/** The longest a name may run before the day part is added to it. */
const LONGEST = 80;

/** Anything a file system would object to, and the runs of space they leave behind. */
function tidy(name: string): string {
  return [...name]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      const awkward = '/\\:*?"<>|';
      return awkward.includes(character) || code < 0x20 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LONGEST)
    .trim();
}

/** "Day 3" for one, "Days 2-4" for a run, "Days 1, 4" for a scatter, "5 days" for more. */
function whichDays(numbers: readonly number[]): string {
  const [first] = numbers;
  const last = numbers[numbers.length - 1];
  if (first === undefined || last === undefined) {
    return "";
  }
  if (numbers.length === 1) {
    return `Day ${String(first)}`;
  }
  if (last - first === numbers.length - 1) {
    return `Days ${String(first)}-${String(last)}`;
  }
  if (numbers.length <= NAMED_AT_MOST) {
    return `Days ${numbers.map(String).join(", ")}`;
  }
  return `${String(numbers.length)} days`;
}

export function exportFileName(input: {
  readonly title: string;
  /** Stands in for the title when the trip has not been named. */
  readonly cityName: string | null;
  /** The days in the file, numbered as the trip numbers them, ascending. */
  readonly dayNumbers: readonly number[];
  /** How many days could have been chosen. The whole trip needs no qualifier. */
  readonly available: number;
}): string {
  const named = tidy(input.title) || tidy(input.cityName ?? "") || "Trip";
  if (input.dayNumbers.length === 0 || input.dayNumbers.length === input.available) {
    return named;
  }
  return `${named} - ${whichDays(input.dayNumbers)}`;
}
