import type { TransitRide, TransitVehicle } from "@/core/model/leg";
import { formatDuration } from "@/core/time/minutes";

/** The vehicle in the words a traveller would use at the stop. */
const VEHICLE_WORDS: Readonly<Record<TransitVehicle, string>> = {
  bus: "Bus",
  tram: "Tram",
  train: "Train",
  ferry: "Ferry",
  other: "Ride",
};

/**
 * One ride as one line: what to catch, where it says it is going, where to get
 * on and off, and how long you are on it. Each part is there only when it is
 * known, so a provider that names no line still leaves a sentence rather than
 * a gap.
 *
 * "Tram GLNELG towards Glenelg · Rundle Mall to Moseley Square · 21 stops · 38 min"
 */
export function rideSentence(ride: TransitRide): string {
  const catching = [
    VEHICLE_WORDS[ride.vehicle],
    ride.line,
    ride.headsign === null ? null : `towards ${ride.headsign}`,
  ].filter((part) => part !== null);
  const between =
    ride.boardAt === null || ride.alightAt === null
      ? null
      : `${ride.boardAt} to ${ride.alightAt}`;
  return [
    catching.join(" "),
    between,
    ride.stops === null ? null : `${String(ride.stops)} ${ride.stops === 1 ? "stop" : "stops"}`,
    formatDuration(ride.durationMinutes),
  ]
    .filter((part) => part !== null)
    .join(" · ");
}
