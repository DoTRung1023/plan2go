import type { Conflict } from "@/core/model/conflict";
import type { ComputedStop } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";
import { ConflictNotice } from "./conflict-notice";
import { formatDayTime } from "./format-day-time";

interface StopCardProps {
  readonly position: number;
  readonly stop: ComputedStop;
  readonly note: string | null;
  readonly conflicts: readonly Conflict[];
}

export function StopCard({ position, stop, note, conflicts }: StopCardProps) {
  const { arrival, departure } = stop;
  const leaves = departure !== null && departure.epochMinutes !== arrival?.epochMinutes;
  const stayText =
    stop.stayMinutes === 0 ? "Not stopping" : `${formatDuration(stop.stayMinutes)} here`;

  return (
    <article className="rounded-card border border-rule bg-paper-raised px-5 py-4">
      <p className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
        Stop {position}
      </p>
      {arrival === null ? (
        <p className="mt-1 text-body text-ink-muted">Time not known</p>
      ) : (
        <p className="font-display text-time-lead font-semibold text-ink tabular-nums">
          {formatDayTime(arrival)}
        </p>
      )}
      <h3 className="mt-1 font-display text-place font-semibold text-ink">{stop.placeName}</h3>
      <p className="mt-1 text-meta text-ink-muted tabular-nums">
        {leaves && departure !== null
          ? `${stayText}, leave at ${formatDayTime(departure)}`
          : stayText}
      </p>
      {note === null ? null : <p className="mt-2 text-body text-ink-muted">{note}</p>}
      {conflicts.map((conflict, index) => (
        <ConflictNotice key={`${conflict.kind}-${String(index)}`} conflict={conflict} />
      ))}
    </article>
  );
}
