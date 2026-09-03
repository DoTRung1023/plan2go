import type { Conflict } from "@/core/model/conflict";
import type { TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { BikeIcon, CarIcon, PlaneIcon, TrainIcon, WalkIcon } from "@/ui/icons";
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

interface LegRowProps {
  readonly leg: ComputedLeg;
  readonly conflicts: readonly Conflict[];
}

/**
 * How you get from one stop to the next, on the thread that joins them. The
 * mode is a word and an icon together, and the duration is the loudest thing in
 * the row because it is what the day is built out of.
 */
export function LegRow({ leg, conflicts }: LegRowProps) {
  const Icon = MODE_ICON[leg.mode];

  return (
    <div className="ml-[2px] grid grid-cols-[30px_minmax(0,1fr)] gap-x-[14px]">
      <div className="flex justify-center py-[2px]">
        <span aria-hidden="true" className="thread" />
      </div>

      <div className="py-[9px]">
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] rounded-row border border-rule py-2 pr-[14px] pl-3">
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
        </div>

        {conflicts.map((conflict, index) => (
          <div key={`${conflict.kind}-${String(index)}`} className="mt-2">
            <ConflictNotice conflict={conflict} />
          </div>
        ))}
      </div>
    </div>
  );
}
