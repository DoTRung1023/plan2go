"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { TransitRide, TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import {
  CarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrainIcon,
  WalkIcon,
} from "@/ui/icons";
import type { LegOption, PlannedLeg } from "./compute-trip";
import { ConflictNotice } from "./conflict-notice";
import type { DayActions } from "./day-actions";
import { formatDistance } from "./format-distance";
import { rideSentence } from "./transit-ride";

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

/**
 * The disc behind the glyph on a closed row, tinted the way the map draws the
 * mode: the accent for walking, sage for public transport, and the warm grey
 * that has always been the drive tint. Each is the 200 step under the 700, so
 * the glyph reads on its own ground at the same weight in every row.
 */
const MODE_TINT: Readonly<Record<TravelMode, string>> = {
  walk: "bg-terracotta-200 text-terracotta-700",
  drive: "bg-neutral-200 text-neutral-700",
  transit: "bg-sage-200 text-sage-700",
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
       * The one in use is drawn on raised paper inside a heavier terracotta
       * line, with its dot filled. The rest sit straight on the well behind a
       * hairline, so the chosen tile is the one thing in the panel that looks
       * like a card.
       */
      /*
       * The tile's rows are the panel's rows: the glyph, the name, the time
       * and the distance each sit on a row shared with the tiles either
       * side, so a name that runs to two lines in one tile makes the row two
       * lines tall in all of them and the times stay level. Comparing those
       * is the whole of what the panel is opened for. When no name wraps
       * the row is one line and nothing is held open for a second.
       */
      className={`row-span-4 grid min-w-0 grid-rows-subgrid items-start justify-items-start gap-y-[5px] rounded-chip px-[10px] pt-[11px] pb-3 text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
        isChosen
          ? "border-[1.5px] border-terracotta bg-paper-raised"
          : unavailable
            ? "border border-rule bg-transparent"
            : "border border-rule bg-transparent hover:border-rule-strong"
      }`}
    >
      <span
        className={`flex w-full items-center justify-between ${
          isChosen ? "text-ink" : "text-ink-muted"
        }`}
      >
        <Icon size={17} strokeWidth={2.4} />
        <span
          aria-hidden="true"
          className={`h-[13px] w-[13px] rounded-pill border-[1.5px] ${
            isChosen
              ? "border-terracotta bg-terracotta"
              : "border-rule-strong bg-transparent"
          }`}
        />
      </span>
      <span className="min-w-0 text-micro/[1.2] font-semibold text-ink-muted [overflow-wrap:anywhere]">
        {MODE_WORDS[option.mode]}
      </span>
      {/* The time on its own line in the display face, the one promoted
          number on the tile, and how far under it in body text at the quiet
          tier: two facts, the second qualifying the first. The weight is
          stated because a step with its leading turned off loses the weight
          the scale gives it. */}
      <span className="font-display text-place/none font-semibold tracking-[-0.01em] text-ink tabular-nums [overflow-wrap:anywhere]">
        {unavailable ? "Unavailable" : formatDuration(option.durationMinutes ?? 0)}
      </span>
      {option.distanceMeters === null ? null : (
        <span className="text-meta/[1.2] text-ink-muted tabular-nums">
          {formatDistance(option.distanceMeters)}
        </span>
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

  /** The way being used, as it was answered. */
  const shown = planned.options.find((option) => option.mode === leg.mode);

  /**
   * Outside the row's button rather than inside it, because the timetable is
   * a link and a link cannot live in a button. It reads as part of the leg
   * all the same: the same indent, directly under the one line.
   */
  const transit =
    covered && leg.mode === "transit" ? (
      <TransitDetail rides={shown?.rides ?? null} directions={planned.directions} />
    ) : null;

  const summary = covered ? (
    <>
      {/* The glyph on a small disc in the mode's own tint. Smaller than a
          stop's number and never terracotta on its own, so it reads as a
          way between two stops rather than as a third one. */}
      <span
        className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill ${MODE_TINT[leg.mode]}`}
      >
        <Icon size={15} strokeWidth={2.4} />
      </span>
      <span className="text-small/none font-semibold whitespace-nowrap text-ink">
        {MODE_WORDS[leg.mode]}
      </span>
      {/* The time stands apart in the display face, because it is what the
          day is built out of and the one number worth reading the row for.
          How far follows it quietly. */}
      <span className="font-display text-time whitespace-nowrap text-ink tabular-nums">
        {formatDuration(leg.durationMinutes ?? 0)}
      </span>
      {leg.distanceMeters === null ? null : (
        <span className="text-meta/none whitespace-nowrap text-ink-muted tabular-nums">
          {formatDistance(leg.distanceMeters)}
        </span>
      )}
    </>
  ) : (
    <span className="text-small/none text-ink-muted">
      {anyWay ? "No way chosen to get there yet" : "No way to get there"}
    </span>
  );

  /**
   * One line inside a hairline, whoever is reading it. Under the pointer,
   * here or on the map, the line darkens and the row sits on the well.
   */
  const rowShape =
    "flex w-full flex-wrap items-center gap-x-[10px] gap-y-[6px] rounded-row border pt-2 pr-[14px] pb-[9px] pl-3 text-left";

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
            className={`${rowShape} ${
              hovered ? "border-rule-strong bg-paper-sunken" : "border-rule bg-transparent"
            }`}
          >
            {summary}
          </div>
        ) : open ? (
          /* Its own scrollbar on a short window, so a panel too tall to fit
             scrolls inside itself rather than pushing the day down past it. */
          <div className="scroll-quiet max-h-[50vh] overflow-y-auto rounded-panel border border-rule bg-paper-sunken px-[14px] pt-[13px] pb-[14px]">
            <div className="mb-[11px] flex items-baseline gap-2">
              {/* No distance beside the heading: every way of covering the leg
                  is about to say its own, and they are not all the same. */}
              <p className="text-small/none font-semibold text-ink-muted">How you get there</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="ml-auto flex items-center gap-1 rounded-pill px-1 py-[2px] text-micro/none font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                Collapse
                <ChevronUpIcon size={13} strokeWidth={2.75} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
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
            className={`${rowShape} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
              hovered
                ? "border-rule-strong bg-paper-sunken"
                : "border-rule bg-transparent hover:border-rule-strong hover:bg-neutral-200"
            }`}
          >
            {summary}
            {/* Accent coloured at the step that reads at this size, with the
                chevron pointing the way the row is about to go. Small and at
                the far end, so it is found rather than read first. */}
            <span className="ml-auto flex items-center gap-[5px] text-micro/none font-semibold whitespace-nowrap text-terracotta-700">
              Change
              <ChevronDownIcon size={13} strokeWidth={2.75} />
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
