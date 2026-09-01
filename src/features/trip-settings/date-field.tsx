"use client";

import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "@/core/model/day";
import { addDays, parseIsoDate, weekdayOf } from "@/core/time/zoned";

const DAYS_IN_WEEK = 7;

/** Matches the calendar's own width class, for the edge test when it opens. */
const CALENDAR_WIDTH = 300;

/** Room to keep between the calendar and the edge of the window. */
const EDGE_GAP = 8;

/** Six rows always, so the calendar does not change height between months. */
const WEEKS_SHOWN = 6;

/** Monday first, because that is how a week reads here. */
const WEEKDAYS = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
];

const MONTH_AND_YEAR = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_ONLY = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" });

const READABLE = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A calendar date is read in UTC, because it is a date and not an instant. */
function asUtc(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(year: number, month: number, day: number): IsoDate {
  const pad = (value: number, width: number): string =>
    String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function firstOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date);
  return iso(year, month, 1);
}

/** Month arithmetic on the first of a month, which never overflows a short month. */
function shiftMonths(first: IsoDate, delta: number): IsoDate {
  const { year, month } = parseIsoDate(first);
  const index = year * 12 + (month - 1) + delta;
  return iso(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** The Monday on or before the first of the month the grid is showing. */
function gridStart(first: IsoDate): IsoDate {
  return addDays(first, -((weekdayOf(first) + 6) % DAYS_IN_WEEK));
}

/** ISO dates sort chronologically as text, so a range test needs no parsing. */
function outOfRange(date: IsoDate, min: string | undefined, max: string | undefined): boolean {
  return (min !== undefined && date < min) || (max !== undefined && date > max);
}

interface DateFieldProps {
  readonly id: string;
  /** Submitted with the form. The visible control is a button, not this. */
  readonly name: string;
  readonly label: string;
  readonly value: IsoDate;
  readonly min?: string;
  readonly max?: string;
  readonly onChange: (value: IsoDate) => void;
}

const TRIGGER =
  "mt-1 flex w-full items-center justify-between rounded-card border border-rule bg-paper-raised px-3 py-2 text-left text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const MONTH_STEP =
  "rounded-card px-2 py-1 text-meta text-terracotta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * A date field with our own calendar behind it.
 *
 * The browser's date picker is drawn by the browser and cannot be reached with
 * CSS, so on a page that is meant to read like a printed guide it arrives as a
 * blue system panel. This is the same control in the palette from DESIGN.md.
 *
 * The month is stepped by two buttons that say which month they go to, because
 * a bare arrow is an icon without a text label.
 */
export function DateField({ id, name, label, value, min, max, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<IsoDate>(value);
  /** The field on the right of a row would open off the side of the window. */
  const [alignEnd, setAlignEnd] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);

  // The roving focus follows the arrow keys, so the focused cell has to be the
  // one the browser is actually on.
  useEffect(() => {
    if (!open) {
      return;
    }
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node && container.current !== null && container.current.contains(target);
      if (!inside) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const month = firstOfMonth(focused);
  const start = gridStart(month);
  const shownMonth = parseIsoDate(month).month;
  const today = new Date().toISOString().slice(0, 10);

  const close = (): void => {
    setOpen(false);
    container.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(id)}`)?.focus();
  };

  const choose = (date: IsoDate): void => {
    onChange(date);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const steps: Readonly<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -DAYS_IN_WEEK,
      ArrowDown: DAYS_IN_WEEK,
    };
    const step = steps[event.key];

    if (step !== undefined) {
      event.preventDefault();
      setFocused(addDays(focused, step));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setFocused(shiftMonths(month, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const cells = Array.from({ length: WEEKS_SHOWN * DAYS_IN_WEEK }, (_unused, index) =>
    addDays(start, index),
  );

  return (
    <div className="relative" ref={container}>
      <label className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </label>
      <input type="hidden" name={name} value={value} />

      <button
        id={id}
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const box = trigger.current?.getBoundingClientRect();
          if (box !== undefined) {
            setAlignEnd(box.left + CALENDAR_WIDTH > window.innerWidth - EDGE_GAP);
          }
          setFocused(value);
          setOpen(!open);
        }}
        className={TRIGGER}
      >
        <span>{READABLE.format(asUtc(value))}</span>
        <span className="text-meta text-ink-faint">{open ? "Close" : "Change"}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`Choose the ${label.toLowerCase()}`}
          className={`absolute top-full z-30 mt-1 w-[300px] rounded-card border border-rule bg-paper-raised p-3 ${
            alignEnd ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setFocused(shiftMonths(month, -1));
              }}
              className={MONTH_STEP}
            >
              {MONTH_ONLY.format(asUtc(shiftMonths(month, -1)))}
            </button>
            <p
              aria-live="polite"
              className="font-display text-place font-semibold text-ink"
            >
              {MONTH_AND_YEAR.format(asUtc(month))}
            </p>
            <button
              type="button"
              onClick={() => {
                setFocused(shiftMonths(month, 1));
              }}
              className={MONTH_STEP}
            >
              {MONTH_ONLY.format(asUtc(shiftMonths(month, 1)))}
            </button>
          </div>

          <div
            ref={grid}
            role="grid"
            aria-label={MONTH_AND_YEAR.format(asUtc(month))}
            onKeyDown={onKeyDown}
            className="mt-3"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((weekday, index) => (
                <span
                  key={index}
                  role="columnheader"
                  className="py-1 text-center text-label font-semibold tracking-[0.08em] text-ink-faint uppercase"
                >
                  <span aria-hidden="true">{weekday.short}</span>
                  <span className="sr-only">{weekday.full}</span>
                </span>
              ))}
            </div>

            {Array.from({ length: WEEKS_SHOWN }, (_unused, week) => (
              <div role="row" key={week} className="grid grid-cols-7">
                {cells
                  .slice(week * DAYS_IN_WEEK, week * DAYS_IN_WEEK + DAYS_IN_WEEK)
                  .map((date) => {
                    const disabled = outOfRange(date, min, max);
                    const selected = date === value;
                    const thisMonth = parseIsoDate(date).month === shownMonth;

                    return (
                      <span
                        role="gridcell"
                        key={date}
                        aria-selected={selected}
                        className="p-[2px]"
                      >
                        <button
                          type="button"
                          data-date={date}
                          disabled={disabled}
                          tabIndex={date === focused ? 0 : -1}
                          aria-current={date === today ? "date" : undefined}
                          onClick={() => {
                            choose(date);
                          }}
                          className={[
                            "flex h-9 w-full items-center justify-center rounded-card border font-display text-meta tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
                            selected
                              ? "border-terracotta bg-terracotta font-semibold text-paper"
                              : date === today
                                ? "border-terracotta bg-transparent text-ink"
                                : "border-transparent bg-transparent",
                            disabled
                              ? "text-ink-faint"
                              : thisMonth || selected
                                ? ""
                                : "text-ink-faint",
                          ].join(" ")}
                        >
                          <span aria-hidden="true">{parseIsoDate(date).day}</span>
                          <span className="sr-only">
                            {READABLE.format(asUtc(date))}
                            {date === today ? ", today" : ""}
                          </span>
                        </button>
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
