import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import { epochMinutesToWallClock } from "@/core/time/zoned";
import { timelineBands, timelineHours } from "./timeline";

interface DayTimelineProps {
  readonly computed: ComputedDay;
}

const BAND_FILL: Readonly<Record<string, string>> = {
  "at-places": "bg-terracotta",
  travelling: "bg-sage-400",
  waiting: "bg-neutral-300",
};

const BAND_WORDS: Readonly<Record<string, string>> = {
  "at-places": "at places",
  travelling: "travelling",
  waiting: "waiting",
};

function bandMinutes(kind: string, computed: ComputedDay): number {
  if (kind === "at-places") {
    return computed.totals.timeAtPlacesMinutes;
  }
  if (kind === "waiting") {
    return computed.totals.waitingMinutes;
  }
  return computed.totals.travelMinutes ?? 0;
}

/**
 * The whole day as one bar: how much of it is spent at places, how much getting
 * between them, and how much waiting for somewhere to open. The hour marks
 * underneath say when, so the bar is read against the clock rather than as a
 * proportion in the abstract.
 *
 * A day with an unresolved leg draws nothing. A partial bar would read as a
 * shorter day rather than an unknown one, and the leg says so where it sits.
 */
export function DayTimeline({ computed }: DayTimelineProps) {
  const bands = timelineBands(computed.totals);
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
            key={band.kind}
            style={{ width: `${String(band.percent)}%` }}
            className={`h-full ${BAND_FILL[band.kind] ?? ""}`}
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
        {bands.map((band) => (
          <li key={band.kind} className="flex items-center gap-[5px] tabular-nums">
            <span
              aria-hidden="true"
              className={`h-[9px] w-[9px] rounded-[2px] ${BAND_FILL[band.kind] ?? ""}`}
            />
            {`${formatDuration(bandMinutes(band.kind, computed))} ${BAND_WORDS[band.kind] ?? ""}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
