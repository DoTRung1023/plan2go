"use client";

import type { DragEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ArrowRightIcon, ClockIcon, CloseIcon, GripIcon, InfoIcon, PlusIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";
import { StayPicker } from "./stay-picker";
import { Notice } from "@/ui/notice";

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
      title="Place details"
      aria-label={`About ${name}`}
      className={TOOL}
    >
      <InfoIcon size={TOOL_GLYPH.info} strokeWidth={TOOL_GLYPH.stroke} />
    </button>
  );
}

/**
 * The glyphs on a tools row, each at the edge that brings the ink it puts on
 * the page to the size of the others.
 *
 * They are drawn in a box of 24 and fill it differently, so the edge is not
 * the size: the X runs 6 to 18, the pencil corner to corner. Measured rather
 * than guessed, painted stroke and all, these land within a tenth of a pixel
 * of each other at about ten and a half. The grip is two columns of dots and
 * cannot be as wide as the rest without being taller than them, so it matches
 * on height and is left narrow. The info circle is set a step over the rest,
 * because a round shape holds less ink than an X of the same extent and reads
 * smaller beside it at a matching size.
 */
export const TOOL_GLYPH = {
  stroke: 2.75,
  info: 14,
  pencil: 11,
  grip: 16,
  close: 17,
} as const;

/** A quarter of an hour: the smallest amount of time worth naming on a day. */
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
  /**
   * What sets the day's leaving time, in place of this stop's arrival. Only
   * the first card of a day with no start point has it, since that arrival
   * is when the day leaves; null on every other card and for a reader.
   */
  readonly leaveAt: ReactNode;
  /**
   * Takes the traveller to the search field for the next place. Only the last
   * card on the day has it, because a place found there is added at the end
   * of the day, after this one; null on every other card and for a reader.
   */
  readonly onAddNext: (() => void) | null;
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
  leaveAt,
  onAddNext,
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
      className={`day-stop group grid grid-cols-[30px_minmax(0,1fr)] gap-x-[13px] rounded-row border bg-paper-raised px-4 py-[13px] ${
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
          the card, or on the last card to the number of the stop that would
          come next, so the line the day hangs on is seen to pass through the
          stop rather than stopping at it. Quieter here than on the page,
          because it is over a raised card and should not compete with it. */}
      <div className="flex flex-col items-center gap-[7px] [--thread-ink:16%]">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-terracotta font-display text-body/none font-semibold text-paper tabular-nums">
          <span aria-hidden="true">{position}</span>
          <span className="sr-only">Stop {position}</span>
        </span>
        <span className="thread flex-1" aria-hidden="true" />
      </div>

      {/* The blocks of the card, spaced once. Each of them carries the
          leading its own type step brought with it, so a gap wide enough to
          separate two boxes separates the words inside them by a good deal
          more, and the card was mostly air. The address keeps its leading
          whatever else goes: it is where the stacked marks of a Vietnamese
          street name land, and nothing here is worth clipping one. */}
      <div className="flex min-w-0 flex-col gap-2">
        {/* The name beside the times, and under them the address beside the
            tools. Three columns rather than two, so the address is not held
            to the name's width: the tools under the times are narrower than
            the times, and the address runs on under the times as far as the
            tools reach. A street and a suburb that broke early against the
            times now mostly fit on one line. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-[10px] gap-y-[3px] [grid-template-areas:'name_times_times'_'address_address_tools']">
          <h3 className="min-w-0 font-display text-place text-ink [grid-area:name]">
            {stop.placeName}
          </h3>
          {address === null ? null : (
            <p className="min-w-0 text-meta text-ink-faint [grid-area:address]">{address}</p>
          )}

          {/* Read, never set, but for one: every time on the day follows
              from when it leaves, worked out through the legs and the stays,
              so the one clock to change is that one, set where it shows.
              With no start point that is this card's arrival on the first
              card, which then comes as the pill that sets it. In the accent,
              a shade down for text at this size: the time is the loudest
              thing on the card, and it is warm rather than black beside the
              disc that shares its colour.

              Both ends of the stay rather than only its beginning. When you
              get somewhere is half of what a stop is; the other half is when
              you are done with it, and it was only ever readable by adding
              the stay underneath to the time above it. The arrow is the same
              one the starter page puts between the two ends of a trip, and
              stands as far off the pill as off a plain time.

              A div rather than a paragraph, because the pill hangs its picker
              from itself and a paragraph may not hold one. */}
          <div
            className="flex items-center gap-[5px] self-start justify-self-end font-display text-time whitespace-nowrap text-terracotta-700 tabular-nums [grid-area:times]"
          >
            {leaveAt === null && stop.arrival === null ? (
              "Time not known"
            ) : (
              <>
                {leaveAt ?? (stop.arrival === null ? null : formatDayTime(stop.arrival))}
                {stop.departure === null ? null : (
                  <>
                    <ArrowRightIcon
                      size={13}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="shrink-0 text-terracotta-700/65"
                    />
                    <span className="sr-only">to</span>
                    {formatDayTime(stop.departure)}
                  </>
                )}
              </>
            )}
          </div>

          <div
            className={`-mr-1 flex items-center self-start justify-self-end group-hover:opacity-100 focus-within:opacity-100 [grid-area:tools] ${
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

        <div className="flex flex-wrap items-center gap-3">
          {/* How long the stop lasts: words for a reader, and for an editor
              the pill that opens the hours and minutes, which is the one
              number on the card a person actually sets. */}
          {actions === null ? (
            <span className="text-meta/none text-ink-muted">
              Stay for {formatDuration(stop.stayMinutes)}
            </span>
          ) : (
            <StayPicker
              placeName={stop.placeName}
              value={stop.stayMinutes}
              disabled={busy === "stay"}
              onChoose={(minutes) => {
                run("stay", () => actions.setStay({ stopId: stop.stopId, stayMinutes: minutes }));
              }}
            />
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
            className="w-full resize-none overflow-hidden rounded-chip border border-rule bg-paper px-[11px] py-[7px] text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint focus-visible:border-terracotta"
          />
        )}

        {error === null ? null : (
          <Notice role="alert">
              {error}
          </Notice>
        )}

      </div>

      {/* The next stop, where it would go: the number it would get, drawn
          dashed on the rail under this card's disc, so the thread the day
          hangs on runs on to it, and beside it the words on the left edge of
          the name above. The time is when this stop is left, which is when
          the way to the next one would begin, not when that one would start:
          the leg between them comes first. One button for the row, so the
          whole of it can be pressed on a phone.

          A second row of the card's grid, set as far below the body as the
          body is from the card's edge. Everything in it is drawn the way the
          same thing already is on the card. The ring is the edge of the
          leaving time's pill, the other dashed outline in the accent a card
          can carry: a pixel, dashed, in the accent at the weight a hovered
          card's edge is drawn. It was the thread bent round for a while, two
          pixels at the whole accent, and beside that pill it was the
          heaviest line on the card by twice. The digit is the disc's. The words are at the stay's step, and the time
          at the step the opening hours are in, since both are the small print
          of the stop. The time sits as far in from the right as the stay's
          own words do from its edge.

          Under the pointer the row takes the fill the card's other controls
          take under the pointer, as a pill from the ring's left edge to where
          the times end, and the ring's dash takes the whole accent, as every
          dashed control's does; the words stay as they are. With the
          keyboard on it the focus ring draws that same pill and there is no
          fill, as on every other control. The card under it lets go
          of its own hover, and so does this stop's marker on the map: the
          slot is about the stop after this one, and the card sinking behind
          it said the pointer was on this one.

          The press does not take focus. A note field left open and empty
          above it closes when it loses focus, and the row it leaves is
          shorter than the field, so if the press moved focus the slot would
          jump up under the pointer before the release and the click would
          land on nothing. Keeping focus where it is lets the click arrive,
          and moving to the search field then closes the note as before. It
          also keeps a press here from starting a drag of the card. */}
      {onAddNext === null ? null : (
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onMouseEnter={() => {
            onHover(null);
          }}
          onMouseLeave={() => {
            onHover(stop.stopId);
          }}
          onClick={onAddNext}
          aria-label={
            stop.departure === null
              ? `Add a place as stop ${String(position + 1)}`
              : `Add a place as stop ${String(position + 1)}, after leaving ${stop.placeName} at ${formatDayTime(stop.departure)}`
          }
          className="group/next col-span-2 mt-[13px] grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-[13px] rounded-pill pr-[10px] text-left hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <span
            aria-hidden="true"
            className="grid h-[30px] w-[30px] place-items-center rounded-pill border border-dashed border-terracotta/55 font-display text-body/none font-semibold text-terracotta-700 tabular-nums group-hover/next:border-terracotta"
          >
            {position + 1}
          </span>
          <span className="text-small/none font-semibold text-terracotta-700">
            Add a place
          </span>
          {stop.departure === null ? null : (
            <span className="text-micro/none whitespace-nowrap text-ink-muted tabular-nums">
              from {formatDayTime(stop.departure)}
            </span>
          )}
        </button>
      )}
    </article>
  );
}
