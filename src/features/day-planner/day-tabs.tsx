"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState, useTransition } from "react";
import type { DayPlan } from "@/core/model/day";
import { PlusIcon } from "@/ui/icons";
import type { EditOutcome } from "./day-actions";
import { formatDayDate, formatDayTab } from "./format-day-date";
import "./day-tabs.css";

interface DayTabsProps {
  readonly days: readonly DayPlan[];
  /**
   * Today in the trip's own zone. It matches no day at all on a trip that has
   * not started or is over, which is the ordinary case for a trip being
   * planned, so nothing is marked then.
   */
  readonly today: string;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /**
   * Puts one more empty day on the end. Null for a reader, who gets the strip
   * and no way to change what is on it.
   */
  readonly onAddDay: (() => Promise<EditOutcome>) | null;
}

/**
 * What is on the day, under the date. Every tab says both, because which day it
 * is and how full it is are two different questions and a reader choosing a tab
 * is usually asking them together.
 *
 * Checkpoints are not counted, the same way they are not numbered: a day of
 * three places and a station changed at is a day of three stops, and the tab
 * has to agree with the numbers down the day it opens. A day that is only
 * places passed through is not empty, so it says what it is instead.
 */
function stopLine(day: DayPlan): string {
  const stops = day.stops.length;
  if (stops > 0) {
    return `${String(stops)} ${stops === 1 ? "stop" : "stops"}`;
  }
  return day.stops.length === 0 ? "empty" : "passing through";
}

/**
 * A handle, not a summary. It carried the day's number, its date and its stop
 * count stacked three deep, which made the strip taller than the heading under
 * it and said three times over what the line below now says once.
 */
const TAB =
  "flex shrink-0 items-center rounded-pill border-0 px-[15px] py-[9px] text-small/none font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

export function DayTabs({
  days,
  today,
  selectedIndex,
  onSelect,
  onAddDay,
}: DayTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
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
      {/* The room under the pills is the strip's own padding over the track
          the scrollbar is always given, so the hairline it draws when a trip
          is long enough sits just under the pills as their edge, and the
          line naming the day is close under the strip whether or not the
          hairline is there. */}
      <div className="day-tabs flex items-center gap-[7px] pb-[4px]">
        <div
          role="tablist"
          aria-label="Days of this trip"
          className="flex shrink-0 items-center gap-[7px]"
        >
      {days.map((day, index) => {
        const selected = index === selectedIndex;
        /**
         * Sage, the second voice, so it never argues with the terracotta that
         * means "the day you are reading". Being chosen is the louder fact of
         * the two, so a day that is both is drawn as chosen and says the rest
         * in words a screen reader reads out.
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
            className={`${TAB} ${
              selected
                ? "bg-terracotta-800 text-paper"
                : isToday
                  ? "bg-sage-100 text-sage-800 hover:bg-sage-200"
                  : "bg-transparent text-ink-muted hover:bg-neutral-200"
            }`}
          >
            {/* The tab no longer draws the date in full or counts the stops.
                Both are on the day's own line the moment it is opened, and a
                reader who cannot see the strip still hears all of it here. */}
            <span className="sr-only">
              {`Day ${String(index + 1)}, ${formatDayDate(day.date)}, ${stopLine(day)}.${
                isToday ? " Today." : ""
              }`}
            </span>
            <span aria-hidden="true" className="tabular-nums">
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
            // As tall as a tab, 13px of text with 9px above and below it, so
            // the row of days ends in a shape of the same height rather than
            // one standing proud of it.
            className="ml-[2px] grid h-[31px] w-[31px] shrink-0 place-items-center rounded-pill border-[1.5px] border-dashed border-rule-strong text-ink-faint hover:border-terracotta hover:text-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <PlusIcon size={15} strokeWidth={2.75} />
          </button>
        )}
      </div>

      {error === null ? null : (
        <p
          role="alert"
          className="mb-[10px] rounded-chip bg-terracotta-200 px-3 py-2 text-micro text-terracotta-900"
        >
          {error}
        </p>
      )}
    </div>
  );
}
