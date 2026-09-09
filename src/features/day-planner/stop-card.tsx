"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ClockIcon, CloseIcon, GripIcon, PinIcon, PlusIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";
import { TimePicker } from "./time-picker";

/** The server's own limit, repeated because that module may not reach the browser. */
const MAX_STAY_MINUTES = 99 * 60 + 59;

/** The one thing about this stop that is currently being written down. */
type Busy = "stay" | "time" | "note" | "remove" | null;

const TOOL =
  "grid h-[22px] w-[22px] place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * Two digits and no more, so the pair reads as one number written in parts.
 *
 * Set a step under what it was. At the body size the numbers stood taller than
 * anything else on their row, so the pill they sit in towered over the opening
 * hours beside it and the two read as different kinds of thing rather than as
 * two facts about the same place.
 */
const STAY_FIELD =
  "w-[24px] rounded-chip bg-transparent py-0 text-center font-display text-meta text-ink caret-terracotta tabular-nums outline-none focus-visible:bg-terracotta-100";

/** Stated, and the same whether the stay is being read or written. */
const STAY_PILL =
  "inline-flex h-[26px] items-center rounded-pill border border-rule bg-paper";

interface StopCardProps {
  /** Its number in the day, or null for a checkpoint, which is not counted. */
  readonly position: number | null;
  /** Somewhere the day passes through: no stay, no number, no time of its own. */
  readonly checkpoint: boolean;
  /** Whether the pointer is on this place, here or on the map beside it. */
  readonly hovered: boolean;
  readonly onHover: (stopId: string | null) => void;
  /** Where the stop sits in its day, counted from zero, which is what a move needs. */
  readonly index: number;
  readonly stop: ComputedStop;
  /**
   * The time the traveller fixed this stop to, or null when it follows the day.
   * It is what was asked for rather than what came out, so it is read from the
   * plan and not from the computed stop beside it.
   */
  readonly startAtMinutes: number | null;
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
  checkpoint,
  hovered,
  onHover,
  index,
  stop,
  startAtMinutes,
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
  /**
   * The note as it was last sent, held until the trip comes back carrying it.
   *
   * Leaving the field is what commits, so without this the card falls back to
   * the trip's copy the instant the field is left, and the trip's copy is
   * still the empty one it had a moment ago: a note just written blinks out,
   * the button that offers to write one takes its place, and both are replaced
   * again when the server answers. Undefined means nothing is in flight.
   */
  const [sent, setSent] = useState<string | null | undefined>(undefined);
  const card = useRef<HTMLElement | null>(null);
  const noteField = useRef<HTMLTextAreaElement | null>(null);
  const hourField = useRef<HTMLInputElement | null>(null);
  const minuteField = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState<Busy>(null);

  // Adjusted during the render that carries the new value rather than in an
  // effect, because an effect would paint the stale one first.
  if (sent !== undefined && sent === note) {
    setSent(undefined);
  }
  const shownNote = sent === undefined ? note : sent;

  /**
   * Which of the card's own controls is waiting on the server, so only that
   * one goes quiet.
   *
   * One flag for the whole card dimmed the time and the stay while a note was
   * being written down, which reads as the card loading rather than as one
   * thing in it being saved, and nothing about the note has any bearing on
   * either of them.
   */
  const run = (
    what: Busy,
    change: () => Promise<{ readonly error: string | null }>,
  ): void => {
    if (saving) {
      return;
    }
    setBusy(what);
    startSaving(async () => {
      setError((await change()).error);
      setBusy(null);
    });
  };

  /**
   * How long the stop lasts, written rather than stepped.
   *
   * Two fields and not one, because an hour and ten minutes is how a person
   * says it and "70" is not. Anything unreadable counts as nothing, and the
   * server clamps the total to the range it allows, so ninety minutes typed
   * into the minutes field is simply an hour and a half.
   */
  const commitStay = (): void => {
    const partOf = (field: HTMLInputElement | null): number => {
      const read = Number(field?.value.trim() ?? "");
      return Number.isFinite(read) && read > 0 ? Math.floor(read) : 0;
    };
    const minutes = Math.min(
      MAX_STAY_MINUTES,
      partOf(hourField.current) * 60 + partOf(minuteField.current),
    );
    // Written back whether or not anything is being sent. The fields are only
    // remounted when the stored stay changes, so leaving them to that showed
    // ninety of anything tidied up the first time and left standing the
    // second, when the total happened to come out the same.
    if (hourField.current !== null) {
      hourField.current.value = String(Math.floor(minutes / 60));
    }
    if (minuteField.current !== null) {
      minuteField.current.value = String(minutes % 60);
    }

    if (actions === null || minutes === stop.stayMinutes) {
      return;
    }
    run("stay", () => actions.setStay({ stopId: stop.stopId, stayMinutes: minutes }));
  };

  /** Enter is done, and escape puts back what the stop already said. */
  const onStayKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (hourField.current !== null) {
        hourField.current.value = String(Math.floor(stop.stayMinutes / 60));
      }
      if (minuteField.current !== null) {
        minuteField.current.value = String(stop.stayMinutes % 60);
      }
      event.currentTarget.blur();
    }
  };

  /** Setting a time to the one it already had is not a change worth a write. */
  const setStartAt = (minutes: number): void => {
    if (actions === null || minutes === startAtMinutes) {
      return;
    }
    run("time", () =>
      actions.setStartAt({ stopId: stop.stopId, startAtMinutes: minutes }),
    );
  };

  const clearStartAt = (): void => {
    if (actions === null || startAtMinutes === null) {
      return;
    }
    run("time", () => actions.setStartAt({ stopId: stop.stopId, startAtMinutes: null }));
  };

  const commitNote = (value: string): void => {
    const tidied = value.trim() === "" ? null : value.trim();
    setWritingNote(false);
    if (actions === null || tidied === shownNote) {
      return;
    }
    setSent(tidied);
    run("note", () => actions.setNote({ stopId: stop.stopId, note: tidied }));
  };

  /**
   * The field is exactly as tall as what is in it.
   *
   * A note is a line or a paragraph and there is no telling which, so a fixed
   * two rows is either empty space under one line or a scrollbar hiding the
   * end of five. Sized to its content there is neither, and the padding above
   * and below is equal, which is what puts a short note in the middle of its
   * own box rather than at the top of a box meant for a longer one.
   *
   * Height is cleared before it is read, because scrollHeight of an element
   * already tall enough is its current height, and a field that had grown
   * would never shrink again.
   */
  const fitNote = (element: HTMLTextAreaElement): void => {
    element.style.height = "auto";
    element.style.height = `${String(element.scrollHeight)}px`;
  };

  useEffect(() => {
    const element = noteField.current;
    if (element !== null) {
      fitNote(element);
    }
  }, [shownNote, writingNote]);

  /**
   * Brought into the panel when the pointer finds it on the map, because a
   * card lit up below the fold is a card nobody sees light up.
   *
   * "nearest" is doing the work: a card already on screen is left exactly
   * where it is, so hovering one here does not scroll the list out from under
   * the pointer, and only a card the map is pointing at off the fold moves,
   * by the least it can.
   */
  useEffect(() => {
    if (hovered) {
      card.current?.scrollIntoView({ block: "nearest" });
    }
  }, [hovered]);

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
      ref={card}
      draggable={actions !== null}
      onDragStart={start}
      onDragOver={over}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => {
        onHover(stop.stopId);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
      /*
       * A checkpoint is a quieter card, not a different thing: the same rule
       * around it and a paler paper under it, sitting between the page and the
       * places the day is actually for. Shorter, too, because there is less on
       * it. Drawn with nothing at all it read as a gap in the list rather than
       * as somewhere the day goes through, and drawn at full strength it read
       * as another stop: both are barely there, and being barely there is the
       * whole of what they have to say.
       */
      className={`group ml-[2px] grid grid-cols-[30px_minmax(0,1fr)] gap-x-[14px] rounded-card border ${
        checkpoint ? "py-[9px] pr-[15px] pl-3" : "bg-paper-raised py-[14px] pr-[15px] pl-3"
      } ${dragging ? "opacity-35" : ""} ${
        dragOver && !dragging
          ? "border-terracotta outline-2 outline-offset-[3px] outline-dashed outline-terracotta"
          : /*
             * Under the pointer here, or under the pointer on the map. A place
             * is a card and a marker at once, and pointing at either has to
             * say which one the other is, or the two panes are two lists that
             * happen to be side by side.
             */
            hovered
            ? "border-terracotta/55 bg-paper-sunken"
            : checkpoint
              ? "border-rule/45 bg-paper-raised/30"
              : "border-rule"
      }`}
    >
      <div className="flex flex-col items-center gap-[7px]">
        {/* A checkpoint is passed through, so it is not one of the numbers
            the day counts off. A quiet ring says it is on the route without
            claiming a place in the order. */}
        {position === null ? (
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[12px_12px_12px_4px] bg-terracotta-300 text-terracotta-900">
            <PinIcon size={15} strokeWidth={2.75} />
            <span className="sr-only">Checkpoint</span>
          </span>
        ) : (
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-terracotta font-display text-[14px] text-paper tabular-nums">
            <span aria-hidden="true">{position}</span>
            <span className="sr-only">Stop {position}</span>
          </span>
        )}
        <span aria-hidden="true" className="thread flex-1" />
      </div>

      <div className="flex min-w-0 flex-col gap-[9px]">
        <div className="flex items-start gap-[10px]">
          <div className="min-w-0 flex-1">
            <h3
              className={
                checkpoint
                  ? "text-meta font-semibold text-ink"
                  : "font-display text-place text-ink"
              }
            >
              {stop.placeName}
            </h3>
            {address === null ? null : (
              <p
                className={
                  checkpoint ? "text-micro text-ink-muted" : "mt-[3px] text-meta text-ink-muted"
                }
              >
                {address}
              </p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-[3px]">
            {actions === null ? (
              <p className="font-display text-time whitespace-nowrap text-ink tabular-nums">
                {stop.arrival === null ? "Time not known" : formatDayTime(stop.arrival)}
              </p>
            ) : (
              <TimePicker
                value={startAtMinutes ?? stop.arrival?.minutesFromMidnight ?? 0}
                fixed={startAtMinutes !== null}
                disabled={busy === "time"}
                label={
                  stop.arrival === null ? "Time not known" : formatDayTime(stop.arrival)
                }
                placeName={stop.placeName}
                onChoose={setStartAt}
                // The first stop is what the day opens on, so following what
                // came before it is not offered there.
                onClear={index === 0 ? undefined : clearStartAt}
              />
            )}
            {stop.waitMinutes === 0 ? null : (
              /* Waiting is a fact about the morning, not a fault in it, so it
                 is a number in the quiet colour rather than a notice. */
              <p className="text-micro whitespace-nowrap text-ink-muted tabular-nums">
                Waits {formatDuration(stop.waitMinutes)}
              </p>
            )}

            {stop.overlapMinutes === 0 ? null : (
              /* Said where it happens and nowhere else: the day was still
                 somewhere else when this stop was due to start. Not a refusal
                 and not a correction, only the number. */
              <p className="text-micro font-semibold whitespace-nowrap text-terracotta-700 tabular-nums">
                Overlaps by {formatDuration(stop.overlapMinutes)}
              </p>
            )}

            {actions === null ? null : (
              <div className="flex items-center gap-[7px]">
                <div
                  className={`-mr-1 flex items-center group-hover:opacity-100 focus-within:opacity-100 ${
                    hovered ? "opacity-100" : "opacity-55"
                  }`}
                >
                {/* A handle, not a shortcut. The arrow keys are left to the
                    page, so a card under the pointer still scrolls. */}
                <button
                  type="button"
                  title="Drag to reorder"
                  aria-label={`Move ${stop.placeName} by dragging it`}
                  className={`${TOOL} cursor-grab active:cursor-grabbing`}
                >
                  <GripIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    run("remove", () => actions.removeStop({ stopId: stop.stopId }));
                  }}
                  disabled={busy === "remove"}
                  aria-label={`Remove ${stop.placeName} from this day`}
                  className={TOOL}
                >
                  <CloseIcon size={13} strokeWidth={2.75} />
                </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {checkpoint ? null : (
          <div className="flex flex-wrap items-center gap-[11px]">
            {actions === null ? (
              <span className={`${STAY_PILL} px-[11px] font-display text-meta text-ink tabular-nums`}>
                Stay for {formatDuration(stop.stayMinutes)}
              </span>
            ) : (
              <div
                // Remounted when the stored stay changes, so the two fields show
                // what was actually kept: type ninety minutes and they come back
                // as an hour and a half.
                key={stop.stayMinutes}
                className={`${STAY_PILL} gap-[2px] pr-[11px] pl-[9px]`}
                onBlur={(event) => {
                  // Moving between the two fields is still one edit, so nothing
                  // is written until the pair as a whole is left.
                  const next = event.relatedTarget;
                  if (next !== hourField.current && next !== minuteField.current) {
                    commitStay();
                  }
                }}
              >
                <span className="pr-[5px] text-micro whitespace-nowrap text-ink-muted">
                  Stay for
                </span>
                <input
                  ref={hourField}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={busy === "stay"}
                  defaultValue={String(Math.floor(stop.stayMinutes / 60))}
                  onKeyDown={onStayKey}
                  aria-label={`Hours at ${stop.placeName}`}
                  className={STAY_FIELD}
                />
                <span className="pr-[3px] text-micro text-ink-muted">hr</span>
                <input
                  ref={minuteField}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={busy === "stay"}
                  defaultValue={String(stop.stayMinutes % 60)}
                  onKeyDown={onStayKey}
                  aria-label={`Minutes at ${stop.placeName}`}
                  className={STAY_FIELD}
                />
                <span className="text-micro text-ink-muted">min</span>
              </div>
            )}


            {openingHours === null ? null : (
              <span className="flex items-center gap-[5px] text-micro text-ink-muted tabular-nums">
                <ClockIcon size={12} className="shrink-0" />
                {openingHours}
              </span>
            )}
          </div>
        )}
        {conflicts.map((conflict, at) => (
          <ConflictNotice key={`${conflict.kind}-${String(at)}`} conflict={conflict} />
        ))}

        {checkpoint ? null : shownNote === null && !writingNote ? (
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
            ref={noteField}
            rows={1}
            defaultValue={shownNote ?? ""}
            autoFocus={writingNote}
            readOnly={actions === null}
            onInput={(event) => {
              fitNote(event.currentTarget);
            }}
            onBlur={(event) => {
              commitNote(event.target.value);
            }}
            placeholder="A note for whoever you are travelling with."
            aria-label={`Note about ${stop.placeName}`}
            className="w-full resize-none overflow-hidden rounded-chip border border-rule bg-paper px-[11px] py-2 text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint focus-visible:border-terracotta"
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
