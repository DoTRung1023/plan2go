import { describe, expect, it } from "vitest";
import type { Conflict } from "@/core/model/conflict";
import { conflictSentence } from "./conflict-sentence";

const ARRIVES_AFTER_CLOSE: Conflict = {
  kind: "arrives-after-close",
  stopId: "stop-1",
  placeName: "Fish Market",
  arrivalMinutes: 16 * 60 + 30,
  closesAt: 16 * 60,
};

const CLOSED_ALL_DAY: Conflict = {
  kind: "closed-all-day",
  stopId: "stop-3",
  placeName: "Adelaide Central Market",
  weekday: 0,
};

const STAY_OVERRUNS_CLOSE: Conflict = {
  kind: "stay-overruns-close",
  stopId: "stop-4",
  placeName: "Art Gallery of South Australia",
  departureMinutes: 17 * 60 + 30,
  closesAt: 17 * 60,
};

const UNRESOLVED_LEG: Conflict = {
  kind: "unresolved-leg",
  fromName: "Apartment",
  toName: "Glenelg Beach",
  legIndex: 0,
};

const EVERY_KIND: readonly Conflict[] = [
  ARRIVES_AFTER_CLOSE,
  CLOSED_ALL_DAY,
  STAY_OVERRUNS_CLOSE,
  UNRESOLVED_LEG,
];

/** Hyphen, en dash, em dash, written as escapes so this file contains none. */
const DASHES = /[-\u2013\u2014]/;

describe("conflictSentence", () => {
  it("names the place and both times when you arrive after closing", () => {
    expect(conflictSentence(ARRIVES_AFTER_CLOSE)).toBe(
      "Fish Market closes at 4:00 pm and you arrive at 4:30 pm.",
    );
  });

  it("names the weekday when the place is closed all day", () => {
    expect(conflictSentence(CLOSED_ALL_DAY)).toBe("Adelaide Central Market is closed on Sunday.");
  });

  it("says when you are still there after closing", () => {
    expect(conflictSentence(STAY_OVERRUNS_CLOSE)).toBe(
      "Art Gallery of South Australia closes at 5:00 pm and you are still there at 5:30 pm.",
    );
  });

  it("says what happened and what it means when a leg could not be answered", () => {
    expect(conflictSentence(UNRESOLVED_LEG)).toBe(
      "Could not work out the travel time from Apartment to Glenelg Beach. Nothing after it is timed.",
    );
  });


  it("writes every kind as a finished sentence, with no dashes and no jargon", () => {
    for (const conflict of EVERY_KIND) {
      const sentence = conflictSentence(conflict);
      expect(sentence).toMatch(/\.$/);
      expect(sentence).not.toMatch(DASHES);
      expect(sentence.toLowerCase()).not.toMatch(/dwell|transit leg|issue detected|went wrong/);
    }
  });
});
