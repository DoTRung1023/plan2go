"use client";

import { useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { BikeIcon, CarIcon, PlaneIcon, TrainIcon, WalkIcon } from "@/ui/icons";
import type { LegOption, PlannedLeg } from "./compute-trip";
import { ConflictNotice } from "./conflict-notice";
import { formatDistance } from "./format-distance";

/** The mode in words, so the map's stroke pattern is never the only source. */
const MODE_WORDS: Readonly<Record<TravelMode, string>> = {
  walk: "Walk",
  cycle: "Cycle",
  drive: "Drive",
  transit: "Public transport",
  flight: "Fly",
};

const MODE_ICON: Readonly<Record<TravelMode, typeof WalkIcon>> = {
  walk: WalkIcon,
  cycle: BikeIcon,
  drive: CarIcon,
  transit: TrainIcon,
  flight: PlaneIcon,
};

/** The two accents split the modes: what you power yourself, and what you ride. */
const MODE_TINT: Readonly<Record<TravelMode, string>> = {
  walk: "bg-terracotta-200 text-terracotta-700",
  cycle: "bg-terracotta-200 text-terracotta-700",
  drive: "bg-neutral-200 text-neutral-700",
  transit: "bg-sage-200 text-sage-700",
  flight: "bg-neutral-200 text-neutral-800",
};

/**
 * Changing how one leg is travelled. Passed in rather than imported, because a
 * feature may not reach into the route that owns the mutation.
 */
export type ChangeLegMode = (input: {
  readonly stopId: string | null;
  readonly mode: TravelMode;
}) => Promise<{ readonly error: string | null }>;

interface LegRowProps {
  readonly leg: ComputedLeg;
  /** Every way of covering this leg, and which one the day is using. */
  readonly planned: PlannedLeg;
  readonly conflicts: readonly Conflict[];
  /** Null for a reader who holds no edit token, who sees the row and no choice. */
  readonly onChange: ChangeLegMode | null;
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

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={chosen}
      className={`flex min-w-0 flex-col items-start gap-[5px] rounded-chip border px-[10px] pt-[11px] pb-3 text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
        chosen
          ? "border-terracotta bg-paper-raised"
          : "border-rule bg-transparent hover:border-rule-strong"
      }`}
    >
      <span
        className={`flex w-full items-center justify-between ${
          chosen ? "text-terracotta-700" : "text-ink-muted"
        }`}
      >
        <Icon size={17} strokeWidth={2.4} />
        <span
          aria-hidden="true"
          className={`h-[13px] w-[13px] rounded-pill border ${
            chosen ? "border-terracotta bg-terracotta" : "border-rule-strong bg-transparent"
          }`}
        />
      </span>
      <span className="text-micro font-semibold text-ink-muted [overflow-wrap:anywhere]">
        {MODE_WORDS[option.mode]}
      </span>
      <span className="font-display text-place text-ink tabular-nums [overflow-wrap:anywhere]">
        {option.durationMinutes === null
          ? "Not known"
          : formatDuration(option.durationMinutes)}
      </span>
      <span className="text-meta text-ink-muted tabular-nums">
        {option.distanceMeters === null ? "" : formatDistance(option.distanceMeters)}
      </span>
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
 * The panel closes on a choice. The row underneath it then says what was
 * chosen, and the times down the rest of the day have moved to match.
 */
export function LegRow({ leg, planned, conflicts, onChange }: LegRowProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const Icon = MODE_ICON[leg.mode];

  const choose = (mode: TravelMode): void => {
    if (onChange === null || saving) {
      return;
    }
    if (mode === planned.chosen) {
      setOpen(false);
      return;
    }
    startSaving(async () => {
      const outcome = await onChange({ stopId: stopIdOf(planned), mode });
      setError(outcome.error);
      if (outcome.error === null) {
        setOpen(false);
      }
    });
  };

  const summary = (
    <>
      <span
        className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill ${MODE_TINT[leg.mode]}`}
      >
        <Icon size={15} strokeWidth={2.4} />
      </span>
      <span className="text-meta font-semibold whitespace-nowrap text-ink">
        {MODE_WORDS[leg.mode]}
      </span>
      {leg.durationMinutes === null ? (
        <span className="text-meta whitespace-nowrap text-ink-muted">
          Travel time not known
        </span>
      ) : (
        <>
          <span className="font-display text-body whitespace-nowrap text-ink tabular-nums">
            {formatDuration(leg.durationMinutes)}
          </span>
          {leg.distanceMeters === null ? null : (
            <span className="text-meta whitespace-nowrap text-ink-muted tabular-nums">
              {formatDistance(leg.distanceMeters)}
            </span>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="ml-[2px] grid grid-cols-[30px_minmax(0,1fr)] gap-x-[14px]">
      <div className="flex justify-center py-[2px]">
        <span aria-hidden="true" className="thread" />
      </div>

      <div className="py-[9px]">
        {onChange === null ? (
          <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] rounded-row border border-rule py-2 pr-[14px] pl-3">
            {summary}
          </div>
        ) : open ? (
          <div className="rounded-panel border border-rule bg-paper-sunken px-[14px] pt-[13px] pb-[14px]">
            <div className="flex items-baseline gap-2">
              <p className="text-label font-semibold text-ink-muted">How you get there</p>
              {leg.distanceMeters === null ? null : (
                <p className="text-micro text-ink-muted tabular-nums">
                  {formatDistance(leg.distanceMeters)}
                </p>
              )}
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
            className="flex w-full flex-wrap items-center gap-x-[10px] gap-y-[6px] rounded-row border border-rule py-2 pr-[14px] pl-3 text-left hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            {summary}
            <span className="ml-auto text-micro font-semibold whitespace-nowrap text-terracotta-700">
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
