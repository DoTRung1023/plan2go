import type { Conflict } from "@/core/model/conflict";
import type { TravelMode } from "@/core/model/leg";
import type { ComputedLeg } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ConflictNotice } from "./conflict-notice";
import { formatDistance } from "./format-distance";

/** The mode in words, so the map's stroke pattern is never the only source. */
const MODE_WORDS: Readonly<Record<TravelMode, string>> = {
  walk: "Walk",
  cycle: "Cycle",
  drive: "Drive",
  transit: "Public transport",
};

interface LegRowProps {
  readonly leg: ComputedLeg;
  readonly conflicts: readonly Conflict[];
}

export function LegRow({ leg, conflicts }: LegRowProps) {
  return (
    <div className="ml-6 border-l border-rule py-3 pl-5">
      <p className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
        Getting there
      </p>
      {leg.durationMinutes === null ? null : (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-body text-ink-muted">{MODE_WORDS[leg.mode]}</span>
          <span className="font-display text-time font-semibold text-ink-muted tabular-nums">
            {formatDuration(leg.durationMinutes)}
          </span>
          {leg.distanceMeters === null ? null : (
            <span className="text-meta text-ink-faint tabular-nums">
              {formatDistance(leg.distanceMeters)}
            </span>
          )}
        </p>
      )}
      {conflicts.map((conflict, index) => (
        <ConflictNotice key={`${conflict.kind}-${String(index)}`} conflict={conflict} />
      ))}
    </div>
  );
}
