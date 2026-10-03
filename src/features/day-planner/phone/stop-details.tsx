"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDuration } from "@/core/time/minutes";
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, MinusIcon, PlusIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import type { PlannedDay } from "../compute-trip";
import type { DayActions } from "../day-actions";
import { formatDayTime } from "../format-day-time";
import { hoursOn } from "../format-opening-hours";
import { StopNote } from "../stop-note";

/** What can be done to a stop from its sheet. */
export type StopActions = Pick<DayActions, "setStay" | "setNote" | "moveStop">;

/** A quarter of an hour a press: the smallest amount of time worth naming on a day. */
const STAY_STEP = 15;

/** A whole day at most: a stay is part of a day, and the day has twenty-four hours. */
const LONGEST_STAY = 24 * 60;

/** How long the stepper waits after the last press before the stay is written. */
const WRITE_AFTER_MS = 700;

const ROW = "flex items-start gap-[10px] text-body font-medium text-ink tabular-nums";

const STEP =
  "grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-neutral-200 text-ink hover:bg-neutral-300 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const MOVE =
  "flex h-11 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] border-rule text-small/none font-semibold text-ink hover:bg-neutral-200 disabled:opacity-45 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * How long the stop lasts, stepped a quarter of an hour at a time, as design
 * 1b's page for a stop has it: "Stay for", a minus, the stay in the display
 * face, a plus. Each press shows at once and nothing is written until the
 * presses stop, so going from one hour to two is one write rather than four.
 * A stay still waiting to be written when the sheet goes is written then.
 */
function StayStepper({
  placeName,
  value,
  onChoose,
}: {
  readonly placeName: string;
  readonly value: number;
  readonly onChoose: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  /** A stay pressed for and not written yet. */
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(value);

  // A stay that came back from the server is what the stepper shows, unless
  // presses since are waiting to be written, which it must not snatch back.
  if (seen !== value) {
    setSeen(value);
    if (!held) {
      setDraft(value);
    }
  }

  const latest = useRef({ draft, held, value, onChoose });
  useEffect(() => {
    latest.current = { draft, held, value, onChoose };
  });

  useEffect(() => {
    if (!held) {
      return;
    }
    const timer = setTimeout(() => {
      setHeld(false);
      if (latest.current.draft !== latest.current.value) {
        latest.current.onChoose(latest.current.draft);
      }
    }, WRITE_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [held, draft]);

  useEffect(
    () => () => {
      const last = latest.current;
      if (last.held && last.draft !== last.value) {
        last.onChoose(last.draft);
      }
    },
    [],
  );

  const step = (by: number): void => {
    setDraft((now) => Math.min(LONGEST_STAY, Math.max(0, now + by)));
    setHeld(true);
  };

  return (
    <div className="flex items-center gap-[10px] rounded-card bg-sheet py-2 pr-2 pl-[18px]">
      <span className="flex-1 text-body font-bold text-ink">Stay for</span>
      <button
        type="button"
        onClick={() => {
          step(-STAY_STEP);
        }}
        disabled={draft <= 0}
        aria-label={`Less time at ${placeName}`}
        className={STEP}
      >
        <MinusIcon size={16} strokeWidth={3} />
      </button>
      <span
        aria-live="polite"
        className="min-w-[92px] text-center font-display text-place text-ink tabular-nums"
      >
        {formatDuration(draft)}
      </span>
      <button
        type="button"
        onClick={() => {
          step(STAY_STEP);
        }}
        disabled={draft >= LONGEST_STAY}
        aria-label={`More time at ${placeName}`}
        className={STEP}
      >
        <PlusIcon size={16} strokeWidth={3} />
      </button>
    </div>
  );
}

interface StopDetailsProps {
  /** The day the stop is on, which need not be the day open in the strip. */
  readonly day: PlannedDay;
  /** Where that day is in the trip, counted from zero, for the words that name it. */
  readonly dayIndex: number;
  readonly stopId: string;
  /** Null for a reader who holds no edit link, who reads all of this and changes none of it. */
  readonly actions: StopActions | null;
}

/**
 * The stop's own part of its sheet on a phone, under the place's name, as
 * design 1b's page for a stop has it: when the place is open, when the day
 * reaches it and leaves it, and how long is spent there. On a phone the day
 * is read on its rail and a stop is changed here, so for someone who may edit
 * the stay is a stepper, the note is a field, and the stop can be moved one
 * place earlier or later in the day, which on a desk is done by dragging its
 * card. It is taken off the day by the sheet's own button.
 *
 * On a desk the card beside the map carries all of it, and this is not drawn.
 */
export function StopDetails({ day, dayIndex, stopId, actions }: StopDetailsProps) {
  const [error, setError] = useState<string | null>(null);
  const [moving, startMoving] = useTransition();
  const [, startWriting] = useTransition();

  const index = day.computed.stops.findIndex((stop) => stop.stopId === stopId);
  const stop = day.computed.stops[index];
  const planned = day.plan.stops.find((one) => one.id === stopId);
  if (stop === undefined || planned === undefined) {
    return null;
  }

  const dayName = `Day ${String(dayIndex + 1)}`;
  const hours = hoursOn(planned.place, day.plan);
  const when =
    stop.arrival === null || stop.departure === null
      ? `${dayName} · time not known`
      : `${dayName} · arrive ${formatDayTime(stop.arrival)}, leave ${formatDayTime(stop.departure)}`;

  const write = (change: () => Promise<{ readonly error: string | null }>): void => {
    startWriting(async () => {
      setError((await change()).error);
    });
  };

  const move = (toPosition: number): void => {
    if (actions === null) {
      return;
    }
    startMoving(async () => {
      setError((await actions.moveStop({ stopId, toPosition })).error);
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:hidden">
      <ul className="flex flex-col gap-3">
        {hours === null ? null : (
          <li className={ROW}>
            <ClockIcon size={16} strokeWidth={2.75} className="mt-[3px] shrink-0 text-terracotta" />
            {hours}
          </li>
        )}
        <li className={ROW}>
          <CalendarIcon size={16} strokeWidth={2.75} className="mt-[3px] shrink-0 text-terracotta" />
          {when}
        </li>
        {actions === null ? (
          <li className={ROW}>
            <ClockIcon size={16} strokeWidth={2.75} className="mt-[3px] shrink-0 text-terracotta" />
            {`Stay for ${formatDuration(stop.stayMinutes)}`}
          </li>
        ) : null}
      </ul>

      {actions === null ? null : (
        <StayStepper
          placeName={stop.placeName}
          value={stop.stayMinutes}
          onChoose={(stayMinutes) => {
            write(() => actions.setStay({ stopId, stayMinutes }));
          }}
        />
      )}

      <StopNote
        placeName={stop.placeName}
        note={planned.note}
        onSave={
          actions === null
            ? null
            : (note) => {
                write(() => actions.setNote({ stopId, note }));
              }
        }
        offerClassName="min-h-10"
      />

      {actions === null || day.plan.stops.length < 2 ? null : (
        <div className="flex gap-2" aria-busy={moving}>
          <button
            type="button"
            disabled={moving || index === 0}
            onClick={() => {
              move(index - 1);
            }}
            className={MOVE}
          >
            <ChevronUpIcon size={15} strokeWidth={2.75} />
            Move earlier
          </button>
          <button
            type="button"
            disabled={moving || index === day.plan.stops.length - 1}
            onClick={() => {
              move(index + 1);
            }}
            className={MOVE}
          >
            <ChevronDownIcon size={15} strokeWidth={2.75} />
            Move later
          </button>
        </div>
      )}

      {moving ? <p className="text-micro text-ink-muted">Working out the new times.</p> : null}
      {error === null ? null : (
        <Notice role="alert" size="meta">
          {error}
        </Notice>
      )}
    </div>
  );
}
