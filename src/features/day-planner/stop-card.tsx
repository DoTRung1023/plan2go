import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ClockIcon } from "@/ui/icons";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";

interface StopCardProps {
  readonly position: number;
  readonly stop: ComputedStop;
  readonly address: string | null;
  readonly note: string | null;
  readonly conflicts: readonly Conflict[];
}

export function StopCard({ position, stop, address, note, conflicts }: StopCardProps) {
  const { arrival, departure } = stop;
  const leaves = departure !== null && departure.epochMinutes !== arrival?.epochMinutes;
  const stayText =
    stop.stayMinutes === 0 ? "Not stopping" : `Stay for ${formatDuration(stop.stayMinutes)}`;

  return (
    <article className="ml-[2px] grid grid-cols-[30px_minmax(0,1fr)] gap-x-[14px] rounded-card border border-rule bg-paper-raised py-[14px] pr-[15px] pl-3">
      <div className="flex flex-col items-center gap-[7px]">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-terracotta font-display text-[14px] text-paper tabular-nums">
          <span aria-hidden="true">{position}</span>
          <span className="sr-only">Stop {position}</span>
        </span>
        <span aria-hidden="true" className="thread flex-1" />
      </div>

      <div className="flex min-w-0 flex-col gap-[9px]">
        <div className="flex items-start gap-[10px]">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-place text-ink">{stop.placeName}</h3>
            {address === null ? null : (
              <p className="mt-[3px] text-meta text-ink-muted">{address}</p>
            )}
          </div>
          <p className="shrink-0 font-display text-time whitespace-nowrap text-ink tabular-nums">
            {arrival === null ? "Time not known" : formatDayTime(arrival)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[11px]">
          <span className="rounded-pill border border-rule bg-paper px-[11px] py-[3px] font-display text-meta text-ink tabular-nums">
            {stayText}
          </span>
          {leaves && departure !== null ? (
            <span className="flex items-center gap-[5px] text-micro text-ink-muted tabular-nums">
              <ClockIcon size={12} className="shrink-0" />
              Leaves at {formatDayTime(departure)}
            </span>
          ) : null}
        </div>

        {conflicts.map((conflict, index) => (
          <ConflictNotice key={`${conflict.kind}-${String(index)}`} conflict={conflict} />
        ))}

        {note === null ? null : (
          <p className="rounded-chip border border-rule bg-paper px-[11px] py-2 text-meta text-ink">
            {note}
          </p>
        )}
      </div>
    </article>
  );
}
