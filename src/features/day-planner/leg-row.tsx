"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { CarIcon, TrainIcon, WalkIcon } from "@/ui/icons";
import type { LegOption, PlannedLeg } from "./compute-trip";
import { ConflictNotice } from "./conflict-notice";
import type { DayActions } from "./day-actions";
import { formatDistance } from "./format-distance";

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
      className={`flex min-w-0 flex-col items-start gap-[5px] rounded-chip border px-[10px] pt-[11px] pb-3 text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
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
      <span className="text-micro font-semibold text-ink-muted [overflow-wrap:anywhere]">
        {MODE_WORDS[option.mode]}
      </span>
      <span className="font-display text-place text-ink tabular-nums [overflow-wrap:anywhere]">
        {unavailable ? "Unavailable" : formatDuration(option.durationMinutes ?? 0)}
      </span>
      <span className="text-meta text-ink-muted tabular-nums">
        {option.distanceMeters === null ? "" : formatDistance(option.distanceMeters)}
      </span>
      {/* Numbers but no shape to the route: nobody could tell us the way, so
          this is the line between the two ends at an assumed speed. Said here
          because the map draws that line the same as any other. */}
      {unavailable || option.path !== null ? null : (
        <span className="text-micro text-ink-faint">Crow flies</span>
      )}
    </button>
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
            className={`flex w-full flex-wrap items-center gap-x-[11px] gap-y-[6px] rounded-chip border-0 px-[10px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
              hovered ? "bg-paper-sunken" : "bg-transparent hover:bg-neutral-200"
            }`}
          >
            {summary}
            <span className="ml-auto text-small/none font-bold whitespace-nowrap text-terracotta-700">
              Change
            </span>
          </button>
        )}

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
