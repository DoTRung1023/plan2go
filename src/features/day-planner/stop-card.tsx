"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ClockIcon, CloseIcon, GripIcon, MinusIcon, PlusIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";

/** Matches the step the server clamps to. */
const STAY_STEP_MINUTES = 15;

const MAX_STAY_MINUTES = 12 * 60;

const TOOL =
  "grid h-[22px] w-[22px] place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const STEP =
  "grid h-[22px] w-[22px] place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface StopCardProps {
  readonly position: number;
  /** Where the stop sits in its day, counted from zero, which is what a move needs. */
  readonly index: number;
  readonly stop: ComputedStop;
  readonly address: string | null;
  readonly note: string | null;
  /** When the place is open on this day, or null when we do not know. */
  readonly openingHours: string | null;
  readonly conflicts: readonly Conflict[];
  /** Null for a reader who holds no edit token, who gets the card and no controls. */
  readonly actions: DayActions | null;
  readonly dragging: boolean;
  readonly dragOver: boolean;
  readonly onDragStart: (index: number) => void;
  readonly onDragOver: (index: number) => void;
  readonly onDrop: (index: number) => void;
  readonly onDragEnd: () => void;
}

/**
 * One stop, and everything about it that can be changed where it is read.
 *
 * The arrival time is the loudest thing in the card, and the two controls that
 * act on the whole stop, moving it and taking it off the day, sit directly
 * under it: they are about the row rather than about anything inside it. They
 * are drawn at reduced weight until the pointer is over the card, and they stay
 * visible either way, because half the people using this are on a phone and
 * have no pointer to hover with.
 */
export function StopCard({
  position,
  index,
  stop,
  address,
  note,
  openingHours,
  conflicts,
  actions,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: StopCardProps) {
  const [writingNote, setWritingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const run = (change: () => Promise<{ readonly error: string | null }>): void => {
    if (saving) {
      return;
    }
    startSaving(async () => {
      setError((await change()).error);
    });
  };

  const setStay = (minutes: number): void => {
    if (actions === null) {
      return;
    }
    run(() => actions.setStay({ stopId: stop.stopId, stayMinutes: minutes }));
  };

  const commitNote = (value: string): void => {
    const tidied = value.trim() === "" ? null : value.trim();
    setWritingNote(false);
    if (actions === null || tidied === note) {
      return;
    }
    run(() => actions.setNote({ stopId: stop.stopId, note: tidied }));
  };

  /** The keyboard's way to reorder, since a drag needs a pointer. */
  const onGripKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (actions === null) {
      return;
    }
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    run(() => actions.moveStop({ stopId: stop.stopId, toPosition: index + step }));
  };

  const start = (event: DragEvent<HTMLElement>): void => {
    event.dataTransfer.effectAllowed = "move";
    onDragStart(index);
  };

  const over = (event: DragEvent<HTMLElement>): void => {
    if (actions === null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    onDragOver(index);
  };

  return (
    <article
      draggable={actions !== null}
      onDragStart={start}
      onDragOver={over}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      onDragEnd={onDragEnd}
      className={`group ml-[2px] grid grid-cols-[30px_minmax(0,1fr)] gap-x-[14px] rounded-card border bg-paper-raised py-[14px] pr-[15px] pl-3 ${
        dragging ? "opacity-35" : ""
      } ${
        dragOver && !dragging
          ? "border-terracotta outline-2 outline-offset-[3px] outline-dashed outline-terracotta"
          : "border-rule"
      }`}
    >
      <div className="flex flex-col items-center gap-[7px]">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-terracotta font-display text-[14px] text-paper tabular-nums">
          <span aria-hidden="true">{position}</span>
          <span className="sr-only">Stop {position}</span>
        </span>
        <span aria-hidden="true" className="thread flex-1" />
      </div>

      <div className="flex min-w-0 flex-col gap-[9px]">
        <div className="flex items-start gap-[10px]">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-place text-ink">{stop.placeName}</h3>
            {address === null ? null : (
              <p className="mt-[3px] text-meta text-ink-muted">{address}</p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-[3px]">
            <p className="font-display text-time whitespace-nowrap text-ink tabular-nums">
              {stop.arrival === null ? "Time not known" : formatDayTime(stop.arrival)}
            </p>
            {actions === null ? null : (
              <div className="-mr-1 flex items-center opacity-55 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onKeyDown={onGripKey}
                  disabled={saving}
                  title="Drag to reorder, or use the arrow keys"
                  aria-label={`Move ${stop.placeName}. Drag it, or use the up and down arrow keys.`}
                  className={`${TOOL} cursor-grab active:cursor-grabbing`}
                >
                  <GripIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    run(() => actions.removeStop({ stopId: stop.stopId }));
                  }}
                  disabled={saving}
                  aria-label={`Remove ${stop.placeName} from this day`}
                  className={TOOL}
                >
                  <CloseIcon size={13} strokeWidth={2.75} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-[11px]">
          {actions === null ? (
            <span className="rounded-pill border border-rule bg-paper px-[11px] py-[3px] font-display text-meta text-ink tabular-nums">
              Stay for {formatDuration(stop.stayMinutes)}
            </span>
          ) : (
            <div className="flex items-center gap-[2px] rounded-pill border border-rule bg-paper px-[3px] py-[2px]">
              <span className="pr-[5px] pl-[9px] text-micro whitespace-nowrap text-ink-muted">
                Stay for
              </span>
              <button
                type="button"
                onClick={() => {
                  setStay(stop.stayMinutes - STAY_STEP_MINUTES);
                }}
                disabled={saving || stop.stayMinutes === 0}
                aria-label={`Less time at ${stop.placeName}`}
                className={STEP}
              >
                <MinusIcon size={12} strokeWidth={3} />
              </button>
              <span className="min-w-[74px] text-center font-display text-body whitespace-nowrap text-ink tabular-nums">
                {formatDuration(stop.stayMinutes)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStay(stop.stayMinutes + STAY_STEP_MINUTES);
                }}
                disabled={saving || stop.stayMinutes >= MAX_STAY_MINUTES}
                aria-label={`More time at ${stop.placeName}`}
                className={STEP}
              >
                <PlusIcon size={12} strokeWidth={3} />
              </button>
            </div>
          )}

          {openingHours === null ? null : (
            <span className="flex items-center gap-[5px] text-micro text-ink-muted tabular-nums">
              <ClockIcon size={12} className="shrink-0" />
              {openingHours}
            </span>
          )}
        </div>

        {conflicts.map((conflict, at) => (
          <ConflictNotice key={`${conflict.kind}-${String(at)}`} conflict={conflict} />
        ))}

        {note === null && !writingNote ? (
          actions === null ? null : (
            <button
              type="button"
              onClick={() => {
                setWritingNote(true);
              }}
              className="flex items-center gap-[5px] self-start pr-1 text-micro font-semibold text-ink-muted hover:text-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <PlusIcon size={12} strokeWidth={2.75} />
              Add a note
            </button>
          )
        ) : (
          <textarea
            rows={2}
            defaultValue={note ?? ""}
            autoFocus={writingNote}
            readOnly={actions === null}
            onBlur={(event) => {
              commitNote(event.target.value);
            }}
            placeholder="A note for whoever you are travelling with."
            aria-label={`Note about ${stop.placeName}`}
            className="w-full resize-none rounded-chip border border-rule bg-paper px-[11px] py-2 text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint focus-visible:border-terracotta"
          />
        )}

        {error === null ? null : (
          <p
            role="alert"
            className="rounded-chip bg-terracotta-200 px-3 py-2 text-micro text-terracotta-900"
          >
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
