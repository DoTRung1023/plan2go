"use client";

import type { DragEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ArrowRightIcon, ClockIcon, CloseIcon, GripIcon, InfoIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";
import { StayPicker } from "./stay-picker";
import { StopNote } from "./stop-note";
import type { CardSpan } from "./touch-carry";
import {
  CARRY_SLOP,
  cardUnder,
  edgeScroll,
  scrolledBy,
  scrollerOf,
  scrollOn,
  spansBeside,
  visibleBand,
} from "./touch-carry";
import { Notice } from "@/ui/notice";

/** The one thing about this stop that is currently being written down. */
type Busy = "stay" | "note" | "remove" | null;

/**
 * A card being carried by a finger on its grip. Kept in a ref rather than in
 * state, since it changes with every movement of the finger and nothing is
 * drawn from it but how far the card has been carried, which is state.
 */
interface Carry {
  readonly pointer: number;
  /** Where the finger went down, in the window, and how far the day was scrolled then. */
  readonly fromY: number;
  readonly fromScrolled: number;
  readonly scroller: HTMLElement | null;
  readonly cards: readonly CardSpan[];
  /** Whether the finger has gone far enough for this to be a carry rather than a press. */
  carried: boolean;
  /** Where the finger is now, in the window. */
  y: number;
  /** The card it is over, which is where the stop goes when it is let go. */
  over: number;
  /** The frame that runs the day on under a finger held near an edge. */
  frame: number;
}

/**
 * A small round button holding one glyph, for what acts on a whole row. The
 * ends of a day draw theirs the same way, so a control means the same thing
 * wherever on the thread it hangs.
 *
 * Forty on a phone, the glyph the same size in the middle of it, where the
 * ends of a day on the timeline carry theirs: pressed with a finger, two of
 * them at twenty two side by side were a third of a fingertip each.
 */
export const TOOL =
  "grid h-[22px] w-[22px] place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta max-lg:h-10 max-lg:w-10";

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
  const card = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState<Busy>(null);

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

  /**
   * The grip under a finger. A pointer drags the card with the browser's own
   * drag, as above; a finger has none on most phones, so here the card goes
   * where the finger takes it, the card it is over is the one outlined, and
   * letting go drops it there. The day itself is told through the same calls
   * the browser's drag makes, so a move is settled in one place however it
   * was made. A press that goes nowhere is only a press.
   */
  const carry = useRef<Carry | null>(null);
  const [lift, setLift] = useState<number | null>(null);
  /**
   * Where the card was when a finger let it go somewhere else, until it has
   * been drawn where it went. A stop let go over the last card lands after
   * it, which near the foot of the window is under the foot of the window, so
   * once it is there it is brought into sight, by the least the page can move.
   */
  const landing = useRef<number | null>(null);
  useEffect(() => {
    if (landing.current !== null && landing.current !== index) {
      landing.current = null;
      card.current?.scrollIntoView({ block: "nearest" });
    }
  }, [index]);

  /** A card that goes while it is carried stops running the day on with it. */
  useEffect(
    () => () => {
      const held = carry.current;
      if (held !== null) {
        cancelAnimationFrame(held.frame);
      }
    },
    [],
  );

  /** The card under the finger, and the card drawn as far down as the finger has gone. */
  const follow = (held: Carry): void => {
    const scrolled = scrolledBy(held.scroller);
    setLift(held.y + scrolled - (held.fromY + held.fromScrolled));
    const under = cardUnder(held.y + scrolled, held.cards, held.over);
    if (under !== held.over) {
      held.over = under;
      onDragOver(under);
    }
  };

  /** Every frame of a carry: the day runs on under a finger held near its edge. */
  const runOn = (): void => {
    const held = carry.current;
    if (held === null) {
      return;
    }
    const band = visibleBand(held.scroller);
    const by = edgeScroll(held.y, band.top, band.bottom);
    if (by !== 0) {
      scrollOn(held.scroller, by);
      follow(held);
    }
    held.frame = requestAnimationFrame(runOn);
  };

  const pickUp = (event: PointerEvent<HTMLButtonElement>): void => {
    const element = card.current;
    if (event.pointerType === "mouse" || actions === null || element === null) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const scroller = scrollerOf(element);
    carry.current = {
      pointer: event.pointerId,
      fromY: event.clientY,
      fromScrolled: scrolledBy(scroller),
      scroller,
      cards: spansBeside(element, scroller),
      carried: false,
      y: event.clientY,
      over: index,
      frame: 0,
    };
  };

  const move = (event: PointerEvent<HTMLButtonElement>): void => {
    const held = carry.current;
    if (held === null || event.pointerId !== held.pointer) {
      return;
    }
    held.y = event.clientY;
    if (!held.carried) {
      if (Math.abs(held.y - held.fromY) < CARRY_SLOP) {
        return;
      }
      held.carried = true;
      onDragStart(index);
      held.frame = requestAnimationFrame(runOn);
    }
    follow(held);
  };

  /** Let go: dropped where the finger is, or put back if the carry was cut off. */
  const letGo = (drop: boolean): void => {
    const held = carry.current;
    if (held === null) {
      return;
    }
    carry.current = null;
    cancelAnimationFrame(held.frame);
    setLift(null);
    if (!held.carried) {
      return;
    }
    if (drop) {
      landing.current = held.over === index ? null : index;
      onDrop(held.over);
    } else {
      onDragEnd();
    }
  };

  return (
    <article
      ref={card}
      data-stop-index={index}
      draggable={actions !== null && lift === null}
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
      /* Carried by a finger, the card itself goes with it, over the rest of
         the day and under the strip of days, lifted onto the shadow of what
         floats; the browser's drag carries a picture of it instead, and
         leaves the card faded where it was. */
      style={lift === null ? undefined : { translate: `0 ${String(lift)}px` }}
      className={`day-stop group grid grid-cols-[30px_minmax(0,1fr)] gap-x-[13px] rounded-row border bg-paper-raised px-4 py-[13px] ${
        lift !== null ? "relative z-[5] shadow-md" : dragging ? "opacity-35" : ""
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
        {/* The name and the address on the left, and on the right the times
            with the tools just under them, the column an end of the day keeps
            too. The tools stay under the times however many lines the name
            and the address run to, rather than dropping to the address's row
            when a long name takes two; the address keeps to the name's width
            beside them. The name comes first in the page, so it is what is
            read out first. */}
        <div className="flex items-start gap-[10px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <h3 className="min-w-0 font-display text-place text-ink">{stop.placeName}</h3>
            {address === null ? null : (
              <p className="min-w-0 text-meta text-ink-faint">{address}</p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-[3px]">
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
            <div className="flex items-center gap-[5px] font-display text-time whitespace-nowrap text-terracotta-700 tabular-nums">
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
                      page, so a card under the pointer still scrolls. Under a
                      finger it carries the card, and the page does not scroll
                      from it, which is what lets the finger move the card
                      rather than the day. */}
                  <button
                    type="button"
                    title="Drag to reorder"
                    aria-label={`Move ${stop.placeName} by dragging it`}
                    onPointerDown={pickUp}
                    onPointerMove={move}
                    onPointerUp={() => {
                      letGo(true);
                    }}
                    onPointerCancel={() => {
                      letGo(false);
                    }}
                    // After a let go has been dealt with this finds nothing to
                    // do; before one, the browser took the finger away.
                    onLostPointerCapture={() => {
                      letGo(false);
                    }}
                    className={`${TOOL} cursor-grab touch-none active:cursor-grabbing`}
                  >
                    <GripIcon size={TOOL_GLYPH.grip} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      run("remove", () => actions.removeStop({ stopId: stop.stopId }));
                    }}
                    disabled={busy === "remove"}
                    title="Remove"
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

        <StopNote
          placeName={stop.placeName}
          note={note}
          onSave={
            actions === null
              ? null
              : (written) => {
                  run("note", () => actions.setNote({ stopId: stop.stopId, note: written }));
                }
          }
        />

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
          whole of it can be pressed.

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
