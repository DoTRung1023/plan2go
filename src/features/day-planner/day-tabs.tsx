"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { useScrollBar } from "@/ui/use-scroll-bar";
import type { DayPlan } from "@/core/model/day";
import { PlusIcon } from "@/ui/icons";
import type { EditOutcome } from "./day-actions";
import { formatDayDate, formatDayTab } from "./format-day-date";
import { formatStops } from "./format-stops";
import { useLocalToday } from "@/ui/use-local-today";
import "./day-tabs.css";
import { Notice } from "@/ui/notice";

interface DayTabsProps {
  readonly days: readonly DayPlan[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /**
   * Puts one more empty day on the end. Null for a reader, who gets the strip
   * and no way to change what is on it.
   */
  readonly onAddDay: (() => Promise<EditOutcome>) | null;
}

/**
 * What is on the day, for a reader who hears the strip rather than sees it.
 * The tab draws only the day and its date, but which day it is and how full
 * it is are two different questions, and a reader choosing a tab is usually
 * asking them together.
 */
function stopLine(day: DayPlan): string {
  const stops = day.stops.length;
  return stops > 0 ? formatStops(stops) : "empty";
}

/**
 * A handle, not a summary: the day's number over its date, and nothing about
 * what is on it. The number came back once the line under the strip that
 * named the open day went, since the tab is now the only place it is said.
 *
 * Every tab as wide as the widest date needs, so the strip reads as a row of
 * days rather than a row of words, however narrow a Monday is beside a
 * Wednesday. A date wider than that still gets its room. 44 tall, the height
 * a finger needs, with the two lines four apart centred in it. Stated rather
 * than left to the lines and their padding, which came to 44.5 and put every
 * pill, and everything under the strip, on half a pixel.
 *
 * The ring is drawn outside, the way it is on every other control: inside,
 * it was terracotta on the chosen day's dark pill, and hard to find. The
 * strip keeps the room for it.
 */
const TAB =
  "flex h-11 min-w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-pill border-0 px-[15px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The day's number: the one uppercase label in the product, at the micro
 * step. It names which day of the trip this is, the way a calendar heads a
 * column, and the date under it is what is read; in capitals it stays a
 * heading at a size that would otherwise be read as the same kind of text as
 * the date. Not spaced out: capitals at this step are already as wide as the
 * date under them wants them to be.
 */
const TAB_NUMBER = "text-micro/none font-semibold uppercase";

const TAB_DATE = "text-small/none font-semibold tabular-nums";

export function DayTabs({ days, selectedIndex, onSelect, onAddDay }: DayTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /**
   * Today on the reader's own clock, which is the day they mean by it. It
   * matches no day at all on a trip that has not started or is over, which
   * is the ordinary case for a trip being planned, so nothing is marked then.
   */
  const today = useLocalToday();
  const watchStrip = useScrollBar("x");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  /**
   * The new day is the last one, and it is opened: adding a day is asking for
   * somewhere to put something, so landing on it is the next thing wanted.
   */
  const add = (): void => {
    if (onAddDay === null || adding) {
      return;
    }
    startAdding(async () => {
      const outcome = await onAddDay();
      setError(outcome.error);
      if (outcome.error === null) {
        onSelect(days.length);
      }
    });
  };

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = days.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight") {
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    }

    if (next === null) {
      return;
    }
    event.preventDefault();
    onSelect(next);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      {/* The strip scrolls, and the button rides at the end of it, after the
          last day. It is a sibling of the tab list rather than inside it: a
          tab list holds tabs, and a button among them is announced as one. */}
      {/* The strip clips whatever leaves it, which is what keeps a sideways
          scroller from growing a bar downwards, so the room a focus ring
          needs outside a tab or the button is kept inside the strip: the
          ring is two pixels drawn two pixels out, and there are four above
          and at either side. Whoever puts the strip on a page takes the four
          above off the space over it, and the strip reaches four out into the
          room at either side of it, so the pills sit where they would have
          anyway and the line under them runs exactly as far as they do.

          Below, seven: the same four, and under them the line the strip
          draws as its scrollbar once a trip is long enough, which sits just
          under the pills as their edge and clear of any ring. The room is
          there whether or not the line is, so the card round the strip sits
          as close under it either way. Eight between the last day and the
          button that adds one. */}
      <div
        ref={watchStrip}
        className="day-tabs scroll-line scroll-shy -mx-[4px] flex items-center gap-2 px-[4px] pt-[4px] pb-[7px]"
      >
        <div
          role="tablist"
          aria-label="Days of this trip"
          className="flex shrink-0 items-center gap-1"
        >
          {days.map((day, index) => {
            const selected = index === selectedIndex;
            /**
             * Sage, the second voice, so it never argues with the terracotta
             * that means "the day you are reading". Being chosen is the
             * louder fact of the two, so a day that is both is drawn as
             * chosen and says the rest in words a screen reader reads out.
             */
            const isToday = day.date === today;
            return (
              <button
                key={day.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`day-tab-${day.id}`}
                aria-selected={selected}
                aria-controls={`day-panel-${day.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  onSelect(index);
                }}
                onKeyDown={(event) => {
                  move(event, index);
                }}
                // Under the pointer a day takes the step every control on
                // paper takes, paper-sunken, and its words go to ink. The
                // neutral fill it had is the one the raised cards use, and on
                // this card's paper it was hardly a change at all.
                className={`${TAB} ${
                  selected
                    ? "bg-terracotta-800 text-paper"
                    : isToday
                      ? "bg-sage-100 text-sage-800 hover:bg-sage-200"
                      : "bg-transparent text-ink-muted hover:bg-paper-sunken hover:text-ink"
                }`}
              >
                {/* The tab draws the day's number and a short date, and a
                    reader who cannot see the strip hears the date in full and
                    what is on the day here instead. */}
                <span className="sr-only">
                  {`Day ${String(index + 1)}, ${formatDayDate(day.date)}, ${stopLine(day)}.${
                    isToday ? " Today." : ""
                  }`}
                </span>
                {/* On the chosen day the number steps back from the date by a
                    sixth, the paper over the dark pill otherwise reading as
                    two lines of equal weight. */}
                <span
                  aria-hidden="true"
                  className={`${TAB_NUMBER} tabular-nums ${selected ? "text-paper/85" : ""}`}
                >
                  {`Day ${String(index + 1)}`}
                </span>
                <span aria-hidden="true" className={TAB_DATE}>
                  {formatDayTab(day.date)}
                </span>
              </button>
            );
          })}
        </div>

        {onAddDay === null ? null : (
          <button
            type="button"
            onClick={add}
            disabled={adding}
            title="Add a day"
            aria-label="Add a day to the end of this trip"
            // Shorter than a tab and centred on the row. As tall as the pills
            // it read as heavier than any of them: a circle fills its height
            // where a word in a pill does not, and a dashed ring is louder
            // than a filled one. Smaller, it is what it is, the way to one
            // more day rather than a day. The glyph in the ink the days'
            // words are in, since the ring already says it is only an offer.
            // Under the pointer the dash takes the whole accent, as every
            // dashed control's does, over the same sunken paper a day takes.
            className="grid h-8 w-8 shrink-0 place-items-center rounded-pill border-[1.5px] border-dashed border-rule-strong text-ink-muted hover:border-terracotta hover:bg-paper-sunken hover:text-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <PlusIcon size={15} strokeWidth={2.75} />
          </button>
        )}
      </div>

      {error === null ? null : (
        <Notice role="alert" className="mb-[7px]">
          {error}
        </Notice>
      )}
    </div>
  );
}
