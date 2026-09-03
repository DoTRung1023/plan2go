import type { DayPlan } from "@/core/model/day";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import { formatDayTime } from "./format-day-time";

const LABEL = "text-label font-semibold text-ink-muted";

interface DaySummaryProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
}

/** "1 stop", "5 stops". A sentence carrying a number has to read as English. */
function counted(value: number, singular: string, plural: string): string {
  return `${String(value)} ${value === 1 ? singular : plural}`;
}

/** The traveller's own word for the place first, then the place itself. */
function endsAt(day: DayPlan): string {
  if (day.end === null) {
    return "The day ends";
  }
  return `Back at ${day.end.label ?? day.end.place.name}`;
}

function summarise(day: DayPlan, computed: ComputedDay): string {
  if (day.stops.length === 0) {
    return "Add a stop and the day starts counting.";
  }
  const { timeOutMinutes, travelMinutes } = computed.totals;
  const parts: string[] = [];
  if (timeOutMinutes !== null) {
    parts.push(`${formatDuration(timeOutMinutes)} out`);
  }
  if (travelMinutes !== null) {
    parts.push(`${formatDuration(travelMinutes)} of it travelling`);
  }
  parts.push(counted(day.stops.length, "stop", "stops"));
  return parts.join(" · ");
}

/**
 * The one number the person planning is actually asking for: what time they get
 * back. It is the largest thing in the panel, and everything under it is the
 * arithmetic behind it.
 *
 * The time the day leaves is read here rather than set here. Nothing in the
 * planner changes it yet, so it is shown as the value it is instead of as a
 * control that would do nothing.
 */
export function DaySummary({ day, computed }: DaySummaryProps) {
  const ends = computed.ends;

  return (
    <div className="flex items-end gap-6 pt-5 pb-4">
      <div className="min-w-0">
        <p className={LABEL}>{endsAt(day)}</p>
        {ends === null ? (
          <p className="py-[10px] text-[16px] text-ink-faint">Not worked out yet</p>
        ) : (
          <p className="mt-[9px] font-display text-hero tracking-[-0.02em] text-ink tabular-nums">
            {formatDayTime(ends)}
          </p>
        )}
        <p className="mt-[9px] text-meta text-ink-muted tabular-nums">
          {summarise(day, computed)}
        </p>
      </div>

      <div className="ml-auto shrink-0 text-right">
        <p className={`${LABEL} mb-2`}>Leaves at</p>
        <p className="rounded-pill border border-rule bg-paper-raised px-[13px] py-[7px] font-display text-place text-ink tabular-nums">
          {formatClock(day.startAtMinutes)}
        </p>
      </div>
    </div>
  );
}
