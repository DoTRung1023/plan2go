import type { DayPlan } from "@/core/model/day";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import { epochMinutesToWallClock } from "@/core/time/zoned";
import type { TimelineKind } from "./timeline";
import { timelineBands, timelineHours } from "./timeline";

interface DayTimelineProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
}

const FILL: Readonly<Record<TimelineKind, string>> = {
  "at-places": "bg-terracotta",
  travelling: "bg-sage-400",
  waiting: "bg-neutral-300",
};

const WORDS: Readonly<Record<TimelineKind, string>> = {
  "at-places": "at places",
  travelling: "travelling",
  waiting: "waiting",
};

/** The key under the bar, which adds each kind up rather than listing it again. */
function legendOf(computed: ComputedDay): readonly { kind: TimelineKind; minutes: number }[] {
  const totals: { kind: TimelineKind; minutes: number }[] = [
    { kind: "at-places", minutes: computed.totals.timeAtPlacesMinutes },
    { kind: "travelling", minutes: computed.totals.travelMinutes ?? 0 },
    { kind: "waiting", minutes: computed.totals.waitingMinutes },
  ];
  return totals.filter((total) => total.minutes > 0);
}

/**
 * The whole day as one bar, in the order it happens: every stretch of
 * travelling, every wait, and every stop, drawn end to end. The clock readings
 * underneath say when, so the bar is read against the day rather than as a
 * proportion in the abstract.
 */
export function DayTimeline({ day, computed }: DayTimelineProps) {
  const bands = timelineBands({ computed, startsAtAPoint: day.start !== null });
  if (bands.length === 0 || computed.ends === null) {
    return null;
  }

  const marks = timelineHours({
    beginEpochMinutes: computed.begins.epochMinutes,
    endEpochMinutes: computed.ends.epochMinutes,
    beginMinutesFromMidnight: computed.begins.minutesFromMidnight,
  });

  return (
    <div className="pb-4">
      <div className="flex h-[15px] overflow-hidden rounded-pill bg-paper-sunken">
        {bands.map((band) => (
          <div
            key={band.key}
            style={{ width: `${String(band.percent)}%` }}
            className={`h-full ${FILL[band.kind]}`}
          />
        ))}
      </div>

      <div className="relative mt-[2px] h-[18px] overflow-hidden">
        {marks.map((mark) => {
          const wall = epochMinutesToWallClock(mark.epochMinutes, computed.timeZone);
          const shift = mark.percent < 4 ? "0" : mark.percent > 94 ? "-100%" : "-50%";
          return (
            <span key={mark.epochMinutes}>
              <span
                aria-hidden="true"
                style={{ left: `${String(mark.percent)}%` }}
                className="absolute top-0 h-[4px] w-px bg-rule-strong"
              />
              <span
                style={{
                  left: `${String(mark.percent)}%`,
                  transform: `translateX(${shift})`,
                }}
                className="absolute top-[5px] text-tick whitespace-nowrap text-ink-muted tabular-nums"
              >
                {formatClock(wall.minutesFromMidnight)}
              </span>
            </span>
          );
        })}
      </div>

      <ul className="mt-[6px] flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-muted">
        {legendOf(computed).map((total) => (
          <li key={total.kind} className="flex items-center gap-[5px] tabular-nums">
            <span
              aria-hidden="true"
              className={`h-[9px] w-[9px] rounded-[2px] ${FILL[total.kind]}`}
            />
            {`${formatDuration(total.minutes)} ${WORDS[total.kind]}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
