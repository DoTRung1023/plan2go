"use client";

import { useId, useState, useTransition } from "react";
import type { EditOutcome } from "./day-actions";
import "./leave-at.css";

/** Minutes from midnight as the value a time field reads and writes. */
function toClock(minutes: number): string {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** The field's value back to minutes, or null while it is not a whole time yet. */
function fromClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
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
 * The field is the browser's own, drawn as the words it shows rather than as
 * a box, the way the dates are on the row that names the trip: it tints under
 * the pointer to say it can be changed, and the time is typed into it. The
 * browser's picker is not offered: it is drawn in the browser's colours and
 * the page cannot reach into it, and a time is two numbers, which are quicker
 * to type than to scroll to. A phone still opens its own picker on a tap,
 * which is the one that fits a thumb.
 *
 * Nothing is written while a time is still being typed. The field is written
 * when it is left or Enter is pressed, so a morning typed a digit at a time
 * is one trip to the server rather than several.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => toClock(value));
  const [seen, setSeen] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // A time that came back from the server is what the field shows.
  if (seen !== value) {
    setSeen(value);
    setDraft(toClock(value));
  }

  /** Setting the time to the one it already was is not a change worth a write. */
  const commit = (raw: string): void => {
    const chosen = fromClock(raw);
    if (chosen === null || chosen === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(chosen)).error);
    });
  };

  return (
    <div className="relative flex flex-none items-center gap-2">
      <label htmlFor={id} className="text-small whitespace-nowrap text-ink-muted">
        Leave at
      </label>

      <input
        id={id}
        type="time"
        value={draft}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="leave-at-field rounded-pill border-0 bg-transparent px-2 py-[5px] text-center text-small/none font-semibold text-ink caret-terracotta tabular-nums outline-none hover:bg-terracotta-100 hover:text-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-45"
      />

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
