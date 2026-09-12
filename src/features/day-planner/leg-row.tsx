"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { TransitRide, TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { CarIcon, TrainIcon, WalkIcon } from "@/ui/icons";
import type { LegOption, PlannedLeg } from "./compute-trip";
import { ConflictNotice } from "./conflict-notice";
import type { DayActions } from "./day-actions";
import { formatDistance } from "./format-distance";
import { rideSentence } from "./transit-ride";

/**
 * The unit beside a number, set quieter and smaller than it.
 *
 * "12 min" and "54 min" are read against each other across three tiles, and
 * what differs is the number: the unit is the same three letters every time,
 * taking up as much of the line as the thing actually being compared. Sized
 * in em rather than pixels, so one rule serves the duration and the distance
 * under it without either being told the other's size.
 */
const UNIT = "text-[0.76em] font-medium text-ink-muted";

/**
 * A measurement with its units drawn back. Split on the spaces the formatters
 * put in, so "1 hr 40 min" quietens both of its units, and a value with no
 * digits in it at all is a word rather than a measurement and is left alone.
 */
function Measured({ value }: { readonly value: string }) {
  if (!/\d/.test(value)) {
    return value;
  }
  return value
    .split(/(\s+)/)
    .map((part, at) =>
      /^\d/.test(part) || part.trim() === "" ? (
        part
      ) : (
        <span key={`${part}-${String(at)}`} className={UNIT}>
          {part}
        </span>
      ),
    );
}

/** The mode in words, so the map's stroke pattern is never the only source. */
export const MODE_WORDS: Readonly<Record<TravelMode, string>> = {
  walk: "Walk",
  drive: "Drive",
  transit: "Public transport",
};

const MODE_ICON: Readonly<Record<TravelMode, typeof WalkIcon>> = {
  walk: WalkIcon,
  drive: CarIcon,
  transit: TrainIcon,
};

interface LegRowProps {
  readonly leg: ComputedLeg;
  /** Every way of covering this leg, and which one the day is using. */
  readonly planned: PlannedLeg;
  readonly conflicts: readonly Conflict[];
  /** Whether the pointer is on this leg, here or on the route on the map. */
  readonly hovered: boolean;
  readonly onHover: (legIndex: number | null) => void;
  /** Null for a reader who holds no edit token, who sees the row and no choice. */
  readonly onChange: DayActions["changeLegMode"] | null;
}

function Option({
  option,
  chosen,
  disabled,
  onPick,
}: {
  readonly option: LegOption;
  readonly chosen: boolean;
  readonly disabled: boolean;
  readonly onPick: () => void;
}) {
  const Icon = MODE_ICON[option.mode];
  /** No route this way, so there is nothing to choose. */
  const unavailable = option.durationMinutes === null;
  /**
   * A mode with no route is not how you are getting there, whatever the day has
   * stored. It can be the one on the stop, from before a reorder or from a
   * default, and marking it as the choice would say a journey is settled that
   * cannot be made at all.
   */
  const isChosen = chosen && !unavailable;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || unavailable}
      aria-pressed={isChosen}
      /*
       * Four things down a tile: what it is, what it is called, how long it
       * takes and how far it is. They were spaced by a gap alone, over line
       * boxes each carrying the leading its own step brought with it, so the
       * space between any two was the gap plus whatever the type either side
       * happened to add, and no two were the same. The leading is turned off
       * where a line cannot wrap and the gap is the whole of the spacing.
       */
      className={`flex min-w-0 flex-col items-start gap-[3px] rounded-chip border px-[10px] pt-[11px] pb-3 text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
        isChosen
          ? "border-terracotta bg-paper-raised"
          : unavailable
            ? "border-rule bg-transparent"
            : "border-rule bg-transparent hover:border-rule-strong"
      }`}
    >
      <span
        className={`flex w-full items-center justify-between ${
          isChosen ? "text-terracotta-700" : "text-ink-muted"
        }`}
      >
        <Icon size={17} strokeWidth={2.4} />
        <span
          aria-hidden="true"
          className={`h-[13px] w-[13px] rounded-pill border ${
            isChosen
              ? "border-terracotta bg-terracotta"
              : "border-rule-strong bg-transparent"
          }`}
        />
      </span>
      {/* The one line here that can run to two, so it keeps a leading, and a
          tighter one than the scale hands it: two words of a mode name are
          closer kin than two lines of a paragraph. */}
      <span className="text-micro/[1.2] font-semibold text-ink-muted [overflow-wrap:anywhere]">
        {MODE_WORDS[option.mode]}
      </span>
      <span className="font-display text-place/none text-ink tabular-nums [overflow-wrap:anywhere]">
        <Measured
          value={unavailable ? "Unavailable" : formatDuration(option.durationMinutes ?? 0)}
        />
      </span>
      <span className="text-meta/none text-ink-muted tabular-nums">
        {option.distanceMeters === null ? null : (
          <Measured value={formatDistance(option.distanceMeters)} />
        )}
      </span>
      {/* Numbers but no shape to the route: nobody could tell us the way, so
          this is the line between the two ends at an assumed speed. Said here
          because the map draws that line the same as any other. */}
      {unavailable || option.path !== null ? null : (
        <span className="text-micro/none text-ink-faint">Crow flies</span>
      )}
    </button>
  );
}

/**
 * What to catch, under a public transport leg, and the way to the timetable.
 *
 * One line per vehicle, in the order they are ridden, because "Public
 * transport · 44 min" says how long and not how: the line to look for on the
 * front of the tram and the stop to get off at are what a traveller standing
 * at the stop actually needs. The walks between are not listed, since the
 * total already counts them and the map draws them.
 *
 * No departure times, because none were asked for. The link is where they
 * live: the same two places and the same way between them, opened in Google
 * Maps with the timetable for the moment the traveller is actually leaving.
 * It is there even when the vehicles are not known, which is every answer
 * cached before they were asked for and every straight line guess.
 */
function TransitDetail({
  rides,
  directions,
}: {
  readonly rides: readonly TransitRide[] | null;
  readonly directions: string | null;
}) {
  return (
    <div className="mt-[3px] px-[10px]">
      {rides === null || rides.length === 0 ? null : (
        <ol className="flex flex-col gap-[3px]">
          {rides.map((ride, index) => (
            <li key={String(index)} className="text-micro text-ink-muted">
              {rideSentence(ride)}
            </li>
          ))}
        </ol>
      )}
      {directions === null ? null : (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[3px] inline-block rounded-pill text-micro font-semibold text-terracotta-700 hover:text-terracotta-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Live times in Google Maps
        </a>
      )}
    </div>
  );
}

/**
 * How you get from one stop to the next, on the thread that joins them.
 *
 * Closed, it is one line: the mode in words and an icon, and the duration,
 * which is the loudest thing in the row because it is what the day is built out
 * of. Open, it is every other way of covering the same ground with what each
 * one costs in time, so the choice is made by reading the alternatives rather
 * than by trying them one at a time.
 *
 * Choosing leaves the panel open. The outline moves to what was picked and the
 * times down the rest of the day move with it, both of which are worth seeing
 * before deciding whether that is the mode you wanted, and trying a second one
 * should not mean opening the panel again. Collapse is what closes it.
 */
export function LegRow({
  leg,
  planned,
  conflicts,
  hovered,
  onHover,
  onChange,
}: LegRowProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const row = useRef<HTMLDivElement | null>(null);

  /**
   * Brought into the panel when the pointer finds this leg on the map, the
   * same way a card is. "nearest" leaves a row already on screen exactly where
   * it is, so hovering one here never scrolls the list out from under the
   * pointer.
   */
  useEffect(() => {
    if (hovered) {
      row.current?.scrollIntoView({ block: "nearest" });
    }
  }, [hovered]);
  const Icon = MODE_ICON[leg.mode];

  const choose = (mode: TravelMode): void => {
    if (onChange === null || saving || mode === planned.chosen) {
      return;
    }
    startSaving(async () => {
      const outcome = await onChange({ stopId: stopIdOf(planned), mode });
      setError(outcome.error);
    });
  };

  /**
   * A leg nobody can cover this way does not name the way. The mode on it is
   * whatever the day has stored, from a default or from before a reorder, and
   * putting "Walk" in front of "Unavailable" reads as a choice that was made
   * rather than one still to make.
   */
  const covered = leg.durationMinutes !== null;
  const anyWay = planned.options.some((option) => option.durationMinutes !== null);

  /**
   * The way being used, as it was answered. Numbers but no shape to the route
   * means nobody could tell us the way, so the row says so where the numbers
   * are read rather than only inside the panel nobody has opened.
   */
  const shown = planned.options.find((option) => option.mode === leg.mode);
  const crowFlies = covered && shown !== undefined && shown.path === null;

  /**
   * Outside the row's button rather than inside it, because the timetable is
   * a link and a link cannot live in a button. It reads as part of the leg
   * all the same: the same indent, directly under the one line.
   */
  const transit =
    covered && leg.mode === "transit" ? (
      <TransitDetail rides={shown?.rides ?? null} directions={planned.directions} />
    ) : null;

  /**
   * How long and how far, as one phrase rather than as two facts of different
   * weights. The duration was set in the display face and the distance beside
   * it in body text, which made a leg shout a number louder than the stop it
   * leads to. Between two places the interesting thing is the pair of them.
   */
  const covering = [
    formatDuration(leg.durationMinutes ?? 0),
    leg.distanceMeters === null ? null : formatDistance(leg.distanceMeters),
    crowFlies ? "crow flies" : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  const summary = covered ? (
    <>
      {/* The glyph on its own, uncircled: a disc around it made the leg look
          like another numbered stop in the list it sits between. */}
      <Icon size={17} strokeWidth={2.4} className="shrink-0 text-ink-muted" />
      <span className="text-small/none font-semibold whitespace-nowrap text-ink">
        {MODE_WORDS[leg.mode]}
      </span>
      <span className="text-small/none whitespace-nowrap text-ink-muted tabular-nums">
        {covering}
      </span>
    </>
  ) : (
    <span className="text-small/none text-ink-muted">
      {anyWay ? "No way chosen to get there yet" : "No way to get there"}
    </span>
  );

  return (
    /*
     * The stop card's grid, set a step to the left of it. A card's thread
     * hangs from its disc, inside its border and padding; the leg's runs down
     * the margin outside, thirteen pixels nearer the edge, which is how the
     * design file draws it and what makes a leg read as the space between two
     * cards rather than as a third column of them. The words on the leg move
     * with the line, so the glyph in front of them still lands under the
     * name of the stop it leads to.
     *
     * The thread is the row's full height less a hair at each end, so the
     * line reads as one from the card above to the card below, with the
     * cards' own padding as the only breaks in it. The space above and below
     * the words is the row's own, which is what lets the thread run through
     * it: a margin would have been a gap in the line.
     */
    <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-x-[13px] pr-[17px] pl-1">
      <div className="flex justify-center py-[2px]">
        <span className="thread" aria-hidden="true" />
      </div>
      <div
        ref={row}
        className="pt-[9px] pb-[10px]"
        onMouseEnter={() => {
          onHover(leg.index);
        }}
        onMouseLeave={() => {
          onHover(null);
        }}
      >
        {onChange === null ? (
          <div
            className={`flex flex-wrap items-center gap-x-[11px] gap-y-[6px] rounded-chip px-[10px] py-2 ${
              hovered ? "bg-paper-sunken" : ""
            }`}
          >
            {summary}
          </div>
        ) : open ? (
          /* Its own scrollbar on a short window, so a panel too tall to fit
             scrolls inside itself rather than pushing the day down past it. */
          <div className="scroll-quiet max-h-[50vh] overflow-y-auto rounded-row bg-paper-sunken px-[14px] pt-[13px] pb-[14px]">
            <div className="flex items-baseline gap-2">
              {/* No distance beside the heading: every way of covering the leg
                  is about to say its own, and they are not all the same. */}
              <p className="text-label font-semibold text-ink-muted">How you get there</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="ml-auto rounded-pill px-1 text-micro font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                Collapse
              </button>
            </div>

            <div className="mt-[11px] grid grid-cols-2 gap-2 lg:grid-cols-3">
              {planned.options.map((option) => (
                <Option
                  key={option.mode}
                  option={option}
                  chosen={option.mode === planned.chosen}
                  disabled={saving}
                  onPick={() => {
                    choose(option.mode);
                  }}
                />
              ))}
            </div>

            {saving ? (
              <p className="mt-2 text-micro text-ink-muted">Working out the new times.</p>
            ) : null}
            {error === null ? null : (
              <p
                role="alert"
                className="mt-2 rounded-chip bg-terracotta-200 px-3 py-2 text-micro text-terracotta-900"
              >
                {error}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setError(null);
            }}
            className={`group flex w-full flex-wrap items-center gap-x-[11px] gap-y-[6px] rounded-chip border-0 px-[10px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
              hovered ? "bg-paper-sunken" : "bg-transparent hover:bg-neutral-200"
            }`}
          >
            {summary}
            {/* Quiet, and the same quiet as the Collapse that takes its place
                once the row is open. In the accent it was the loudest thing
                on a line whose job is to say how long the leg takes: the way
                to change it should not outrank what there is to change. The
                whole row is the button and lights up under the pointer, so
                the word has no affordance to carry on its own. */}
            <span className="ml-auto text-small/none font-bold whitespace-nowrap text-ink-muted group-hover:text-ink">
              Change
            </span>
          </button>
        )}

        {transit}

        {conflicts.map((conflict, index) => (
          <div key={`${conflict.kind}-${String(index)}`} className="mt-2">
            <ConflictNotice conflict={conflict} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Null means the leg out to where the day ends, which the day itself owns. */
function stopIdOf(planned: PlannedLeg): string | null {
  return planned.target.kind === "stop" ? planned.target.stopId : null;
}
