"use client";

import { useState, useTransition } from "react";
import type { EditOutcome } from "./day-actions";

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
 * The browser's own time field, in a pill on the raised paper an input sits
 * on, with its label on the same line: the line it shares is one line tall,
 * and a label stacked above the field made the header taller than the day it
 * names. Both are set at the small step the date beside them uses, so the row
 * reads as one line of one size. Nothing is written while the field is being
 * typed into: a time is committed when the field is left or Enter is pressed,
 * so a morning typed a digit at a time is one trip to the server rather than
 * four.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  /** Setting the time to the one it already was is not a change worth a write. */
  const commit = (raw: string): void => {
    const minutes = fromClock(raw);
    if (minutes === null || minutes === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(minutes)).error);
    });
  };

  return (
    <label className="relative flex flex-none items-center gap-2">
      <span className="text-small whitespace-nowrap text-ink-muted">Leave at</span>
      {/* Keyed on the value, so a time that came back from the server after a
          change is what the field shows, and one that failed to save is left
          as it was typed, under the sentence saying why. */}
      <input
        key={value}
        type="time"
        defaultValue={toClock(value)}
        disabled={saving}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="rounded-pill border border-rule bg-paper-raised px-3 py-[6px] text-center text-small/none font-semibold text-ink caret-terracotta tabular-nums disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      />

      {/* Hangs off the field, over what is under it rather than in the row
          with it, the way the name and the dates say what went wrong. */}
      {error === null ? null : (
        <p
          role="alert"
          className="absolute top-full right-0 z-20 mt-[5px] max-w-[260px] rounded-chip bg-terracotta-200 px-[11px] py-[6px] text-micro font-semibold text-terracotta-900 shadow-md"
        >
          {error}
        </p>
      )}
    </label>
  );
}
