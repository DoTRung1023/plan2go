import { Fragment } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { StopId } from "@/core/model/stop";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import { HomeIcon } from "@/ui/icons";
import { ConflictNotice } from "./conflict-notice";
import { LegRow } from "./leg-row";
import { StopCard } from "./stop-card";

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

/**
 * Where the day starts and where it ends. A different shape from a stop, not
 * merely a different colour: a rounded square in sage against the numbered
 * terracotta discs of the stops between them.
 */
function Anchor({
  endpoint,
  fallback,
  time,
}: {
  readonly endpoint: DayEndpoint;
  /** Said when the place has no address of its own. */
  readonly fallback: string;
  readonly time: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-row px-[2px] py-[14px]">
      <span className="ml-2 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[12px_12px_12px_4px] bg-sage-600 text-paper">
        <HomeIcon size={15} strokeWidth={2.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-meta font-semibold text-ink">
          {endpointName(endpoint)}
        </span>
        <span className="block text-micro text-ink-muted">
          {endpoint.place.address ?? fallback}
        </span>
      </span>
      <span className="ml-auto pr-2 font-display text-place whitespace-nowrap text-ink-muted tabular-nums">
        {time ?? "Time not known"}
      </span>
    </div>
  );
}

/**
 * The day as a person reads it, top to bottom: where it starts if it starts
 * anywhere, every leg and every stop in order, and where it ends if it ends
 * anywhere. Every conflict sits against the stop or the leg it belongs to.
 */
export function DayItinerary({ day, computed }: DayItineraryProps) {
  const notes = new Map(day.stops.map((stop) => [stop.id, stop.note]));
  const addresses = new Map(day.stops.map((stop) => [stop.id, stop.place.address]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = day.start === null ? -1 : 0;
  const legToEnd = day.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const endConflicts = computed.conflicts.filter((conflict) => conflict.kind === "ends-next-day");

  return (
    <div>
      {day.start === null ? null : (
        <Anchor
          endpoint={day.start}
          fallback="Where the day starts"
          time={formatClock(computed.begins.minutesFromMidnight)}
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
              address={addresses.get(stop.stopId) ?? null}
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
        <Anchor
          endpoint={day.end}
          fallback="Where the day ends"
          time={
            computed.ends === null ? null : formatClock(computed.ends.minutesFromMidnight)
          }
        />
      )}

      {endConflicts.map((conflict) => (
        <div key={conflict.kind} className="mt-2">
          <ConflictNotice conflict={conflict} />
        </div>
      ))}
    </div>
  );
}
