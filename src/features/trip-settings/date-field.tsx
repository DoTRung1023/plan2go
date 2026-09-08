"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "@/core/model/day";
import { addDays, parseIsoDate, weekdayOf } from "@/core/time/zoned";

const DAYS_IN_WEEK = 7;

/** The full two-month panel, including its border. */
const CALENDAR_WIDTH = 542;

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

/** ISO dates sort chronologically as text, so these tests need no parsing. */
function outsideRange(
  date: IsoDate,
  min: string | undefined,
  max: string | undefined,
): boolean {
  return (min !== undefined && date < min) || (max !== undefined && date > max);
}

interface DateRangeFieldProps {
  readonly id: string;
  readonly startName: string;
  readonly endName: string;
  readonly label: string;
  readonly start: IsoDate;
  readonly end: IsoDate;
  /** Earliest and latest days that may appear at either end of the range. */
  readonly min?: string;
  readonly max?: string;
  /** Both ends counted. Applied once a first day has been picked. */
  readonly maxDays?: number;
  readonly onChange: (range: { readonly start: IsoDate; readonly end: IsoDate }) => void;
  /** Sits under the calendars, inside the panel. Where the save button lives. */
  readonly footer?: ReactNode;
  /** Closing without saving lets an editing form restore its stored dates. */
  readonly onClose?: () => void;
}

interface MonthGridProps {
  readonly month: IsoDate;
  readonly focused: IsoDate;
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly today: string;
  readonly min?: string;
  readonly max?: string;
  readonly onChoose: (date: IsoDate) => void;
}

const TRIGGER =
  "mt-1 flex min-h-[46px] w-full items-center gap-2 rounded-pill border border-rule bg-paper-raised px-[14px] py-[6px] text-left text-ink hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const MONTH_STEP =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-body font-semibold text-terracotta-700 hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

function MonthGrid({
  month,
  focused,
  start,
  end,
  today,
  min,
  max,
  onChoose,
}: MonthGridProps) {
  const startCell = gridStart(month);
  const shownMonth = parseIsoDate(month).month;
  const cells = Array.from({ length: WEEKS_SHOWN * DAYS_IN_WEEK }, (_unused, index) =>
    addDays(startCell, index),
  );

  return (
    <div className="min-w-0 flex-1">
      <p className="text-center font-display text-body text-ink">
        {MONTH_AND_YEAR.format(asUtc(month))}
      </p>

      <div role="grid" aria-label={MONTH_AND_YEAR.format(asUtc(month))} className="mt-2">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={index}
              role="columnheader"
              className="pb-[5px] text-center text-tick font-semibold text-ink-muted"
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
                const thisMonth = parseIsoDate(date).month === shownMonth;
                if (!thisMonth) {
                  return <span role="gridcell" aria-hidden="true" key={date} className="h-8" />;
                }

                const disabled = outsideRange(date, min, max);
                const isStart = date === start;
                const isEnd = date === end;
                const endpoint = isStart || isEnd;
                const inRange = date > start && date < end;

                return (
                  <span
                    role="gridcell"
                    key={date}
                    aria-selected={endpoint || inRange}
                    className={`p-px ${endpoint || inRange ? "bg-terracotta-100" : ""}`}
                  >
                    <button
                      type="button"
                      data-date={date}
                      disabled={disabled}
                      tabIndex={date === focused ? 0 : -1}
                      aria-current={date === today ? "date" : undefined}
                      aria-label={`${READABLE.format(asUtc(date))}${
                        isStart && isEnd
                          ? ", first and last day"
                          : isStart
                            ? ", first day"
                            : isEnd
                              ? ", last day"
                              : ""
                      }${date === today ? ", today" : ""}`}
                      onClick={() => {
                        onChoose(date);
                      }}
                      className={[
                        "relative z-10 flex h-[30px] w-full items-center justify-center rounded-pill border font-display text-micro tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
                        endpoint
                          ? "border-terracotta bg-terracotta text-paper"
                          : inRange
                            ? "border-transparent bg-terracotta-100 text-ink hover:bg-terracotta-200"
                            : date === today
                              ? "border-terracotta bg-transparent text-ink"
                              : "border-transparent bg-transparent text-ink hover:bg-neutral-200",
                        disabled ? "text-ink-faint" : "",
                      ].join(" ")}
                    >
                      {parseIsoDate(date).day}
                    </button>
                  </span>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One field for both ends of a trip, with a range calendar behind it.
 *
 * The first pick begins a new range and the second completes it. Until that
 * second pick, both ends share the same date so the form never contains an
 * impossible range. A wide window gets the adjacent month as context; a small
 * one keeps the same interaction in a single-month panel that fits the screen.
 */
export function DateRangeField({
  id,
  startName,
  endName,
  label,
  start,
  end,
  min,
  max,
  maxDays,
  onChange,
  footer,
  onClose,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [focused, setFocused] = useState<IsoDate>(start);
  const [visibleMonth, setVisibleMonth] = useState<IsoDate>(firstOfMonth(start));
  const [wide, setWide] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const closing = useRef(onClose);

  useEffect(() => {
    closing.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, open, visibleMonth, wide]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const media = window.matchMedia("(min-width: 640px)");
    const updateWidth = (): void => {
      setWide(media.matches);
    };
    updateWidth();
    media.addEventListener("change", updateWidth);

    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node && container.current !== null && container.current.contains(target);
      if (!inside) {
        setOpen(false);
        closing.current?.();
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      media.removeEventListener("change", updateWidth);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const close = (): void => {
    setOpen(false);
    onClose?.();
    trigger.current?.focus();
  };

  const keepVisible = (date: IsoDate): void => {
    const dateMonth = firstOfMonth(date);
    const afterPanels = shiftMonths(visibleMonth, wide ? 2 : 1);
    if (dateMonth < visibleMonth) {
      setVisibleMonth(dateMonth);
    } else if (dateMonth >= afterPanels) {
      setVisibleMonth(wide ? shiftMonths(dateMonth, -1) : dateMonth);
    }
  };

  const choose = (date: IsoDate): void => {
    setFocused(date);
    keepVisible(date);

    if (selecting === "start" || date < start) {
      onChange({ start: date, end: date });
      setSelecting("end");
      return;
    }

    onChange({ start, end: date });
    setSelecting("start");
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
      const next = addDays(focused, step);
      setFocused(next);
      keepVisible(next);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = shiftMonths(firstOfMonth(focused), event.key === "PageUp" ? -1 : 1);
      setFocused(next);
      keepVisible(next);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const latestEnd =
    selecting === "end" && maxDays !== undefined ? addDays(start, maxDays - 1) : max;
  const availableMax =
    max === undefined || latestEnd === undefined
      ? latestEnd ?? max
      : latestEnd < max
        ? latestEnd
        : max;

  return (
    <div className="relative" ref={container}>
      <label htmlFor={id} className="text-label font-semibold text-ink-muted">
        {label}
      </label>
      <input type="hidden" name={startName} value={start} />
      <input type="hidden" name={endName} value={end} />

      <button
        id={id}
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${READABLE.format(asUtc(start))} to ${READABLE.format(asUtc(end))}`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const box = trigger.current?.getBoundingClientRect();
          if (box !== undefined) {
            const panelWidth = window.matchMedia("(min-width: 640px)").matches
              ? CALENDAR_WIDTH
              : box.width;
            setAlignEnd(box.left + panelWidth > window.innerWidth - EDGE_GAP);
          }
          setSelecting("start");
          setFocused(start);
          setVisibleMonth(firstOfMonth(start));
          setOpen(true);
        }}
        className={TRIGGER}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-tick font-semibold text-ink-muted">First day</span>
          <span className="block truncate text-meta tabular-nums">{READABLE.format(asUtc(start))}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-meta text-ink-faint">
          →
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-tick font-semibold text-ink-muted">Last day</span>
          <span className="block truncate text-meta tabular-nums">{READABLE.format(asUtc(end))}</span>
        </span>
        <span className="hidden w-[42px] shrink-0 text-right text-micro font-semibold text-terracotta-700 min-[420px]:inline">
          {open ? "Close" : "Change"}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose trip dates"
          className={`absolute top-full z-30 mt-2 w-full rounded-panel border border-rule bg-paper-raised p-[10px] shadow-md sm:w-[542px] ${
            alignEnd ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                const previous = shiftMonths(visibleMonth, -1);
                setVisibleMonth(previous);
                setFocused(previous);
              }}
              className={MONTH_STEP}
            >
              ←
            </button>
            <p aria-live="polite" className="text-center text-micro font-semibold text-ink-muted">
              {selecting === "start" ? "Choose the first day" : "Now choose the last day"}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                const next = shiftMonths(visibleMonth, 1);
                setVisibleMonth(next);
                setFocused(next);
              }}
              className={MONTH_STEP}
            >
              →
            </button>
          </div>

          <div ref={grid} onKeyDown={onKeyDown} className="flex gap-4">
            <MonthGrid
              month={visibleMonth}
              focused={focused}
              start={start}
              end={end}
              today={new Date().toISOString().slice(0, 10)}
              min={min}
              max={availableMax}
              onChoose={choose}
            />
            {wide ? (
              <MonthGrid
                month={shiftMonths(visibleMonth, 1)}
                focused={focused}
                start={start}
                end={end}
                today={new Date().toISOString().slice(0, 10)}
                min={min}
                max={availableMax}
                onChoose={choose}
              />
            ) : null}
          </div>

          {footer === undefined || footer === null ? null : (
            <div className="mt-2 border-t border-rule pt-2">{footer}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
