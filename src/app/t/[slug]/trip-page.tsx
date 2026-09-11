import type { Trip } from "@/core/model/trip";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { todayIn } from "@/server/trips/time-zones";
import { TripEditor } from "./trip-editor";
import { travelProvider } from "./travel";

interface TripPageProps {
  /** Already read, by whichever link is rendering it. */
  readonly trip: Trip;
  /**
   * The key out of the edit link, or null for the plain link. It is the only
   * difference between the two pages: the same trip, read by anyone holding the
   * link and changed only by someone holding the key.
   */
  readonly editKey: string | null;
}

/**
 * The trip itself, shared by both links so neither can drift from the other.
 *
 * Times come from the straight line provider until the Google Routes adapter
 * lands. The engine is given resolved legs either way, so nothing here changes
 * when the real one arrives.
 */
export async function TripPage({ trip, editKey }: TripPageProps) {
  const days = await computeTrip(trip, travelProvider());

  return (
    <TripEditor
      title={trip.title}
      slug={trip.slug}
      days={days}
      centre={trip.centre}
      cityName={trip.cityName}
      /* Today where the trip is, not where the reader is: a trip in Hanoi read
         from Adelaide is on its Tuesday, whatever the reader's clock says. */
      today={todayIn(trip.timeZone)}
      editKey={editKey}
    />
  );
}
