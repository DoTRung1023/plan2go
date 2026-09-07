"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState, useTransition } from "react";
import type { DayPlan } from "@/core/model/day";
import { PlusIcon } from "@/ui/icons";
import type { EditOutcome } from "./day-actions";
import { formatDayDate } from "./format-day-date";
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
  const stops = day.stops.filter((stop) => !stop.checkpoint).length;
  if (stops > 0) {
    return `${String(stops)} ${stops === 1 ? "stop" : "stops"}`;
  }
  return day.stops.length === 0 ? "empty" : "passing through";
}

const TAB =
  "flex shrink-0 flex-col items-center gap-[2px] rounded-pill border px-[15px] pt-[5px] pb-[6px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

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
    <div className="border-b border-rule">
      {/* The strip scrolls, and the button rides at the end of it, after the
          last day. It is a sibling of the tab list rather than inside it: a
          tab list holds tabs, and a button among them is announced as one. */}
      <div className="day-tabs flex items-center gap-[6px] pb-[10px]">
        <div
          role="tablist"
          aria-label="Days of this trip"
          className="flex shrink-0 items-center gap-[6px]"
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
                ? "border-terracotta-800 bg-terracotta-800 text-paper"
                : isToday
                  ? "border-sage-600 bg-sage-100 text-sage-800 hover:border-sage-700"
                  : "border-rule bg-transparent text-ink-muted hover:border-rule-strong"
            }`}
          >
            {isToday ? <span className="sr-only">Today. </span> : null}
            <span className="text-meta font-semibold">Day {index + 1}</span>
            <span className="text-tick tabular-nums opacity-80">
              {formatDayDate(day.date)}
            </span>
            <span className="text-tick tabular-nums opacity-65">{stopLine(day)}</span>
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
            className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-pill border border-dashed border-rule-strong text-ink-muted hover:border-terracotta hover:text-terracotta disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <PlusIcon size={16} strokeWidth={2.75} />
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
