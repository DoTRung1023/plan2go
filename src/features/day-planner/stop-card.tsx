"use client";

import type { DragEvent } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ClockIcon, CloseIcon, GripIcon, MinusIcon, PhotosIcon, PlusIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";

/** The server's own limit, repeated because that module may not reach the browser. */
const MAX_STAY_MINUTES = 99 * 60 + 59;

/** The one thing about this stop that is currently being written down. */
type Busy = "stay" | "note" | "remove" | null;

/**
 * A small round button holding one glyph, for what acts on a whole row. The
 * ends of a day draw theirs the same way, so a control means the same thing
 * wherever on the thread it hangs.
 */
export const TOOL =
  "grid h-[22px] w-[22px] place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The glyph that opens what a place is like: its pictures, its rating, what
 * people say. First in the row of tools, before the ones that change the day,
 * because it is the one a reader gets too. Shared with the ends of a day for
 * the same reason TOOL is: the question is the same wherever it is asked.
 */
export function AboutPlaceButton({
  name,
  onOpen,
}: {
  readonly name: string;
  readonly onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="About this place"
      aria-label={`About ${name}`}
      className={TOOL}
    >
      <PhotosIcon size={TOOL_GLYPH.photos} strokeWidth={TOOL_GLYPH.stroke} />
    </button>
  );
}

/**
 * The glyphs on a tools row, each at the edge that brings it to the size of
 * the others. They are drawn in a box of 24 and fill it differently: the X
 * runs from 6 to 18, the photograph from 3 to 21, so at one edge the X was
 * two thirds the size of the photograph beside it. Roughly nine pixels of
 * glyph each, and one stroke for all of them.
 */
export const TOOL_GLYPH = {
  stroke: 2.75,
  photos: 12,
  pencil: 13,
  grip: 13,
  close: 16,
} as const;

/** A quarter of an hour: the smallest amount of time worth naming on a day. */
const STAY_STEP = 15;

/** The little round button either side of the stay. */
const STAY_STEPPER =
  "grid h-6 w-6 shrink-0 place-items-center rounded-pill border border-rule bg-paper-raised text-ink-muted hover:border-terracotta hover:bg-terracotta hover:text-paper disabled:opacity-40 disabled:hover:border-rule disabled:hover:bg-paper-raised disabled:hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface StopCardProps {
  /** Its number in the day, counted from one. */
  readonly position: number;
  /** Whether the pointer is on this place, here or on the map beside it. */
  readonly hovered: boolean;
  readonly onHover: (stopId: string | null) => void;
  /** Opens what the place is like: its pictures, its rating, what people say. */
  readonly onOpen: () => void;
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
 * The arrival time is the loudest thing in the card, and the controls that
 * act on the whole stop, opening its place, moving it and taking it off the
 * day, sit directly under it: they are about the row rather than about
 * anything inside it. They are drawn at reduced weight until the pointer is
 * over the card, and they stay visible either way, because half the people
 * using this are on a phone and have no pointer to hover with.
 */
export function StopCard({
  position,
  hovered,
  onHover,
  onOpen,
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
   * Never below one step, and never past what storage will take: a stop nobody
   * stays at is a stop to remove, and a stay longer than the server's limit is
   * a write that would be refused after the fact.
   */
  const stepStay = (by: number): void => {
    if (actions === null) {
      return;
    }
    const minutes = Math.min(MAX_STAY_MINUTES, Math.max(STAY_STEP, stop.stayMinutes + by));
    if (minutes === stop.stayMinutes) {
      return;
    }
    run("stay", () => actions.setStay({ stopId: stop.stopId, stayMinutes: minutes }));
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
      className={`day-stop group grid grid-cols-[30px_minmax(0,1fr)] gap-x-[13px] rounded-row border bg-paper-raised px-4 py-[15px] ${
        dragging ? "opacity-35" : ""
      } ${
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
            : "border-rule"
      }`}
    >
      {/* The disc, and the thread running on down behind it to the foot of
          the card, so the line the day hangs on is seen to pass through the
          stop rather than stopping at it. Quieter here than on the page,
          because it is over a raised card and should not compete with it. */}
      <div className="flex flex-col items-center gap-[7px] [--thread-ink:16%]">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-terracotta font-display text-body/none font-semibold text-paper tabular-nums">
          <span aria-hidden="true">{position}</span>
          <span className="sr-only">Stop {position}</span>
        </span>
        <span className="thread flex-1" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-col gap-[11px]">
        <div className="flex items-start gap-[10px]">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-place text-ink">{stop.placeName}</h3>
            {address === null ? null : (
              <p className="mt-[3px] text-meta text-ink-faint">{address}</p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-[3px]">
            {/* Read, never set. Every time on the day follows from when it
                leaves, worked out through the legs and the stays, so the one
                clock to change is beside the day's name at the top of the
                panel. In the accent, a shade down for text at this size: the
                time is the loudest thing on the card, and it is warm rather
                than black beside the disc that shares its colour. */}
            <p className="font-display text-time whitespace-nowrap text-terracotta-700 tabular-nums">
              {stop.arrival === null ? "Time not known" : formatDayTime(stop.arrival)}
            </p>
            {stop.waitMinutes === 0 ? null : (
              /* Waiting is a fact about the morning, not a fault in it, so it
                 is a number in the quiet colour rather than a notice. */
              <p className="text-micro whitespace-nowrap text-ink-muted tabular-nums">
                Waits {formatDuration(stop.waitMinutes)}
              </p>
            )}

            <div
              className={`-mr-1 flex items-center group-hover:opacity-100 focus-within:opacity-100 ${
                hovered ? "opacity-100" : "opacity-55"
              }`}
            >
              {/* For anyone reading, not only whoever can edit: what a place
                  is like is the question the people travelling ask too. */}
              <AboutPlaceButton name={stop.placeName} onOpen={onOpen} />
              {actions === null ? null : (
                <>
                  {/* A handle, not a shortcut. The arrow keys are left to the
                      page, so a card under the pointer still scrolls. */}
                  <button
                    type="button"
                    title="Drag to reorder"
                    aria-label={`Move ${stop.placeName} by dragging it`}
                    className={`${TOOL} cursor-grab active:cursor-grabbing`}
                  >
                    <GripIcon size={TOOL_GLYPH.grip} />
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
                    <CloseIcon size={TOOL_GLYPH.close} strokeWidth={TOOL_GLYPH.stroke} />
                  </button>
                </>
              )}
            </div>

          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Fifteen minutes a press. A stay is a rough intention, not a
              measurement, and two number fields asked for a precision nobody
              planning a morning actually has. */}
          {actions === null ? (
            <span className="text-meta/none text-ink-muted">
              Stay for {formatDuration(stop.stayMinutes)}
            </span>
          ) : (
            <span className="flex items-center gap-[7px] text-meta/none text-ink-muted">
              <button
                type="button"
                disabled={busy === "stay" || stop.stayMinutes <= STAY_STEP}
                aria-label={`Less time at ${stop.placeName}`}
                onClick={() => {
                  stepStay(-STAY_STEP);
                }}
                className={STAY_STEPPER}
              >
                <MinusIcon size={11} strokeWidth={3} />
              </button>
              <span className="min-w-[74px] text-center font-semibold tabular-nums">
                {formatDuration(stop.stayMinutes)}
              </span>
              <button
                type="button"
                disabled={busy === "stay" || stop.stayMinutes >= MAX_STAY_MINUTES}
                aria-label={`More time at ${stop.placeName}`}
                onClick={() => {
                  stepStay(STAY_STEP);
                }}
                className={STAY_STEPPER}
              >
                <PlusIcon size={11} strokeWidth={3} />
              </button>
            </span>
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

        {shownNote === null && !writingNote ? (
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
