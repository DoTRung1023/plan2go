import { Fragment } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { StopId } from "@/core/model/stop";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import { ConflictNotice } from "./conflict-notice";
import { DayTotals } from "./day-totals";
import { LegRow } from "./leg-row";
import { StopCard } from "./stop-card";

const LABEL = "text-label font-semibold tracking-[0.08em] text-ink-faint uppercase";

interface DayItineraryProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
}

function conflictsAtStop(conflicts: readonly Conflict[], stopId: StopId): readonly Conflict[] {
  return conflicts.filter((conflict) => "stopId" in conflict && conflict.stopId === stopId);
}

function conflictsOnLeg(conflicts: readonly Conflict[], legIndex: number): readonly Conflict[] {
  return conflicts.filter(
    (conflict) => conflict.kind === "unresolved-leg" && conflict.legIndex === legIndex,
  );
}

/** The traveller's own label first, then the place it stands for. */
function endpointName(endpoint: DayEndpoint): string {
  if (endpoint.label === null) {
    return endpoint.place.name;
  }
  return `${endpoint.label}, ${endpoint.place.name}`;
}

function Endpoint({
  label,
  time,
  endpoint,
}: {
  readonly label: string;
  readonly time: string | null;
  readonly endpoint: DayEndpoint;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className={LABEL}>{label}</span>
      <span className="font-display text-time font-semibold text-ink tabular-nums">
        {time ?? "Time not known"}
      </span>
      <span className="text-body text-ink-muted">{endpointName(endpoint)}</span>
    </div>
  );
}

/**
 * The day as a person reads it, top to bottom: where it starts if it starts
 * anywhere, every leg and every stop in order, where it ends if it ends
 * anywhere, and what it all adds up to. Every conflict sits against the stop or
 * the leg it belongs to.
 */
export function DayItinerary({ day, computed }: DayItineraryProps) {
  const notes = new Map(day.stops.map((stop) => [stop.id, stop.note]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = day.start === null ? -1 : 0;
  const legToEnd = day.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const endConflicts = computed.conflicts.filter((conflict) => conflict.kind === "ends-next-day");

  return (
    <div>
      {day.start === null ? null : (
        <Endpoint
          label="Start"
          time={formatClock(computed.begins.minutesFromMidnight)}
          endpoint={day.start}
        />
      )}

      {computed.stops.map((stop, index) => {
        const leg = computed.legs[index + legOffset];
        return (
          <Fragment key={stop.stopId}>
            {leg === undefined ? null : (
              <LegRow leg={leg} conflicts={conflictsOnLeg(computed.conflicts, leg.index)} />
            )}
            <StopCard
              position={index + 1}
              stop={stop}
              note={notes.get(stop.stopId) ?? null}
              conflicts={conflictsAtStop(computed.conflicts, stop.stopId)}
            />
          </Fragment>
        );
      })}

      {legToEnd === undefined ? null : (
        <LegRow leg={legToEnd} conflicts={conflictsOnLeg(computed.conflicts, legToEnd.index)} />
      )}

      {day.end === null ? null : (
        <Endpoint
          label="End"
          time={computed.ends === null ? null : formatClock(computed.ends.minutesFromMidnight)}
          endpoint={day.end}
        />
      )}
      {endConflicts.map((conflict) => (
        <ConflictNotice key={conflict.kind} conflict={conflict} />
      ))}

      <DayTotals totals={computed.totals} />
    </div>
  );
}
