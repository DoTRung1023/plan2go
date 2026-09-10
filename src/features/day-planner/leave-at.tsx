"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatClock } from "@/core/time/minutes";
import type { EditOutcome } from "./day-actions";

/**
 * Five minutes. Finer than the quarter hour a stay steps by, because a day
 * that leaves at twenty past nine leaves at twenty past nine, and coarse
 * enough that the whole hour is a short list rather than a long one.
 */
const STEP_MINUTES = 5;

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from(
  { length: 60 / STEP_MINUTES },
  (_unused, index) => index * STEP_MINUTES,
);

const HEADING = "px-[2px] text-label font-semibold text-ink-muted";

const LIST =
  "scroll-quiet mt-[4px] h-[152px] overflow-y-auto rounded-chip border border-rule bg-paper p-[3px]";

// Two digits every time, so they are centred rather than ranged left against
// a column no wider than they are.
const ROW =
  "block w-full rounded-chip px-[6px] py-[4px] text-center text-meta text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

const ROW_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

/**
 * The time, in a pill the shape of every other control, on the raised paper
 * an input sits on. Open, it wears the accent, which says the time is being
 * changed rather than that it was.
 */
const PILL =
  "inline-flex h-[30px] items-center rounded-pill border px-[13px] font-display text-time whitespace-nowrap tabular-nums disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const PILL_REST =
  "border-rule bg-paper-raised text-ink hover:border-rule-strong hover:bg-paper-sunken";

const PILL_OPEN = "border-terracotta bg-paper-raised text-terracotta-700";

interface LeaveAtProps {
  /** When the day begins, as minutes from local midnight. */
  readonly value: number;
  readonly onChoose: (minutes: number) => Promise<EditOutcome>;
}

/**
 * When the day leaves: the one clock on the day, beside the line that names
 * it. Every other time follows from this one, worked out through the legs and
 * the stays, which is why no stop and no end of the day offers a time of its
 * own to set.
 *
 * The browser's time control is drawn by the browser and cannot be reached
 * with CSS, which is the same reason the calendar in this product is hand
 * built: on a page meant to read like a printed guide, a system widget arrives
 * as a system widget. This is that control in the palette from DESIGN.md.
 *
 * Two lists rather than two grids and a third control. The hour runs 00 to 23,
 * which is what removes the third: there is nothing to choose that is not
 * either an hour or a minute. Nothing is written while you are choosing,
 * because two taps would otherwise be two trips to the server and one time the
 * traveller never meant, so the button underneath says what it will set and
 * does it once.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => Math.floor(value / 60) % 24);
  const [minute, setMinute] = useState(
    () => Math.floor((value % 60) / STEP_MINUTES) * STEP_MINUTES,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const hours = useRef<HTMLDivElement | null>(null);
  const minutes = useRef<HTMLDivElement | null>(null);

  /** Both lists open on what is chosen, rather than at midnight and on the hour. */
  useEffect(() => {
    if (!open) {
      return;
    }
    for (const list of [hours.current, minutes.current]) {
      if (list === null) {
        continue;
      }
      const row = list.querySelector<HTMLElement>('[data-chosen="true"]');
      if (row === null) {
        continue;
      }
      list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node &&
        container.current !== null &&
        container.current.contains(target);
      if (!inside) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const chosen = hour * 60 + minute;

  /** Setting the time to the one it already was is not a change worth a write. */
  const choose = (): void => {
    setOpen(false);
    if (chosen === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(chosen)).error);
    });
  };

  return (
    <div ref={container} className="relative flex flex-none items-center gap-2">
      <span className="text-label font-semibold whitespace-nowrap text-ink-muted">
        Leave at
      </span>
      <button
        type="button"
        ref={trigger}
        disabled={saving}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`The day leaves at ${formatClock(value)}. Change it.`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          // Opens on what the day is set to, not on wherever the lists were
          // left the last time.
          setHour(Math.floor(value / 60) % 24);
          setMinute(Math.floor((value % 60) / STEP_MINUTES) * STEP_MINUTES);
          setOpen(true);
        }}
        className={`${PILL} ${open ? PILL_OPEN : PILL_REST}`}
      >
        {formatClock(value)}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="When the day leaves"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="absolute top-full right-0 z-30 mt-2 w-[142px] rounded-panel border border-rule bg-paper-raised p-2 text-left shadow-md"
        >
          <div className="flex gap-[6px]">
            <div className="min-w-0 flex-1">
              <p className={HEADING}>Hour</p>
              <div ref={hours} className={LIST}>
                {HOURS.map((one) => (
                  <button
                    key={one}
                    type="button"
                    data-chosen={one === hour}
                    onClick={() => {
                      setHour(one);
                    }}
                    className={`${ROW} ${one === hour ? ROW_CHOSEN : ""}`}
                  >
                    {String(one).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className={HEADING}>Minute</p>
              <div ref={minutes} className={LIST}>
                {MINUTES.map((one) => (
                  <button
                    key={one}
                    type="button"
                    data-chosen={one === minute}
                    onClick={() => {
                      setMinute(one);
                    }}
                    className={`${ROW} ${one === minute ? ROW_CHOSEN : ""}`}
                  >
                    {String(one).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={choose}
            className="mt-2 w-full rounded-pill bg-terracotta px-3 py-[6px] text-meta font-semibold text-paper tabular-nums hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Set {formatClock(chosen)}
          </button>
        </div>
      ) : null}

      {/* Hangs off the control, over what is under it rather than in the row
          with it, the way the name and the dates say what went wrong. */}
      {error === null ? null : (
        <p
          role="alert"
          className="absolute top-full right-0 z-20 mt-[5px] max-w-[260px] rounded-chip bg-terracotta-200 px-[11px] py-[6px] text-micro font-semibold text-terracotta-900 shadow-md"
        >
          {error}
        </p>
      )}
    </div>
  );
}
