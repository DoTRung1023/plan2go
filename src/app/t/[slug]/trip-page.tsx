import type { Trip } from "@/core/model/trip";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { TripEditor } from "./trip-editor";
import { tripTravelProvider } from "./travel";

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
 * Whichever link it is, the trip was read by the page that owns the link, and
 * this is where its legs are answered and its times worked out.
 */
export async function TripPage({ trip, editKey }: TripPageProps) {
  const days = await computeTrip(trip, await tripTravelProvider(trip, "after-replying"));

  return (
    <>
      {/* The map's script and tiles come from these two hosts, and the script
          is only asked for once the page has hydrated and the map has mounted.
          Opening the connections now, from the head, means that by then the
          name is resolved and the handshake done, and what is left is the
          download. Next lifts these into the head from here. */}
      <link rel="preconnect" href="https://maps.googleapis.com" />
      <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="" />
      <TripEditor
        title={trip.title}
        slug={trip.slug}
        days={days}
        centre={trip.centre}
        cityName={trip.cityName}
        editKey={editKey}
      />
    </>
  );
}
