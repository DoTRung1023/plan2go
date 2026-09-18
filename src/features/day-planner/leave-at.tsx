"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { EditOutcome } from "./day-actions";
import "./leave-at.css";

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from({ length: 60 }, (_unused, minute) => minute);

/**
 * Seven rows showing, the chosen one in the middle, more either side. As
 * narrow as two digits in a pill can be: the columns are read, not searched,
 * and a wide panel over a small field looked like more than it was.
 */
const LIST = "leave-at-list h-[196px] w-[44px] overflow-y-auto";

// Two digits every time, so they are centred rather than ranged left against
// a column no wider than they are.
const ROW =
  "block w-full rounded-chip py-[6px] text-center font-display text-time text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

const ROW_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

/**
 * The time as words on the line rather than as a box, the way the dates are
 * on the row that names the trip: it tints under the pointer to say it can be
 * changed, and stays tinted while its picker is open.
 */
const TRIGGER =
  "rounded-pill px-2 py-[5px] text-small/none font-semibold tabular-nums hover:bg-terracotta-100 hover:text-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** Minutes from midnight on the clock: "09:05". */
function toClock(minutes: number): string {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

interface LeaveAtProps {
  /** When the day begins, as minutes from local midnight. */
  readonly value: number;
  readonly onChoose: (minutes: number) => Promise<EditOutcome>;
}

/**
 * When the day leaves: the one clock on the day, at the end of the line that
 * names it. Every other time follows from this one, worked out through the
 * legs and the stays, which is why no stop and no end of the day offers a
 * time of its own to set.
 *
 * The time is a button, and the picker it opens is not the browser's: that
 * one is drawn by the browser in the browser's colours and the page cannot
 * reach into it, so it is drawn here in the palette from DESIGN.md. Two
 * columns, hours and minutes, opening on the time that is set, each choice
 * showing on the line the moment it is clicked, and no button to press
 * afterwards: clicking away is what closes it. Nothing is typed, so there is
 * no half-written time to refuse.
 *
 * Nothing is written while a time is still being chosen. The picker writes
 * when it closes, so a morning picked as an hour and then a minute is one
 * trip to the server rather than two.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const hours = useRef<HTMLDivElement | null>(null);
  const minutes = useRef<HTMLDivElement | null>(null);

  // A time that came back from the server is what the line shows, unless the
  // picker is open on a choice that has not been written yet, which must not
  // be snatched back by the save that went before it.
  if (seen !== value) {
    setSeen(value);
    if (!open) {
      setDraft(value);
    }
  }

  const hour = Math.floor(draft / 60) % 24;
  const minute = draft % 60;

  /** Both columns open on what is chosen, rather than at midnight and on the hour. */
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

  /** Setting the time to the one it already was is not a change worth a write. */
  const close = (): void => {
    setOpen(false);
    if (draft === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(draft)).error);
    });
  };

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
        close();
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  });

  return (
    <div ref={container} className="relative flex flex-none items-center gap-2">
      <label htmlFor={id} className="text-small whitespace-nowrap text-ink-muted">
        Leave at
      </label>

      <button
        id={id}
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={saving}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        className={`${TRIGGER} ${open ? "bg-terracotta-100 text-terracotta-700" : "text-ink"}`}
      >
        {toClock(draft)}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="When the day leaves"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              trigger.current?.focus();
            }
          }}
          className="absolute top-full right-0 z-30 mt-2 flex gap-[2px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-md"
        >
          <div ref={hours} className={LIST}>
            {HOURS.map((one) => (
              <button
                key={one}
                type="button"
                data-chosen={one === hour}
                onClick={() => {
                  setDraft(one * 60 + minute);
                }}
                className={`${ROW} ${one === hour ? ROW_CHOSEN : ""}`}
              >
                {String(one).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div ref={minutes} className={LIST}>
            {MINUTES.map((one) => (
              <button
                key={one}
                type="button"
                data-chosen={one === minute}
                onClick={() => {
                  setDraft(hour * 60 + one);
                }}
                className={`${ROW} ${one === minute ? ROW_CHOSEN : ""}`}
              >
                {String(one).padStart(2, "0")}
              </button>
            ))}
          </div>
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
