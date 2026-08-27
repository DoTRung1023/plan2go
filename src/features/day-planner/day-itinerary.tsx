import { Fragment } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { DayPlan } from "@/core/model/day";
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

function Endpoint({
  label,
  time,
  placeName,
}: {
  readonly label: string;
  readonly time: string | null;
  readonly placeName: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className={LABEL}>{label}</span>
      <span className="font-display text-time font-semibold text-ink tabular-nums">
        {time ?? "Time not known"}
      </span>
      <span className="text-body text-ink-muted">{placeName}</span>
    </div>
  );
}

/**
 * The day as a person reads it, top to bottom: when they walk out, every leg
 * and every stop in order, when they are back, and what it all adds up to.
 * Every conflict sits against the stop or the leg it belongs to.
 */
export function DayItinerary({ day, computed }: DayItineraryProps) {
  const notes = new Map(day.stops.map((stop) => [stop.id, stop.note]));
  const returnLeg = computed.legs[computed.stops.length];
  const returnConflicts = computed.conflicts.filter(
    (conflict) => conflict.kind === "returns-next-day",
  );

  return (
    <div>
      <Endpoint
        label="Leave"
        time={formatClock(computed.leave.minutesFromMidnight)}
        placeName={day.homeBase.name}
      />

      {computed.stops.map((stop, index) => {
        const leg = computed.legs[index];
        return (
          <Fragment key={stop.stopId}>
            {leg === undefined ? null : (
              <LegRow leg={leg} conflicts={conflictsOnLeg(computed.conflicts, index)} />
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

      {returnLeg === undefined ? null : (
        <LegRow
          leg={returnLeg}
          conflicts={conflictsOnLeg(computed.conflicts, computed.stops.length)}
        />
      )}

      <Endpoint
        label="Back"
        time={
          computed.returnHome === null
            ? null
            : formatClock(computed.returnHome.minutesFromMidnight)
        }
        placeName={day.homeBase.name}
      />
      {returnConflicts.map((conflict) => (
        <ConflictNotice key={conflict.kind} conflict={conflict} />
      ))}

      <DayTotals totals={computed.totals} />
    </div>
  );
}
