import { notFound } from "next/navigation";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { TripEditor } from "./trip-editor";
import { travelProvider } from "./travel";

interface TripPageProps {
  readonly slug: string;
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
export async function TripPage({ slug, editKey }: TripPageProps) {
  const trip = await prismaTripRepository.findBySlug(slug);
  if (trip === null) {
    notFound();
  }

  const days = await computeTrip(trip, travelProvider());

  return (
    <TripEditor
      title={trip.title}
      slug={trip.slug}
      days={days}
      centre={trip.centre}
      editKey={editKey}
    />
  );
}
