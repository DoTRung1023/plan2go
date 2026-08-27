import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { PLACEHOLDER_TRIP } from "@/features/day-planner/placeholder-trip";
import { TripWorkspace } from "./trip-workspace";

/**
 * Times come from the straight line provider until the Google Routes adapter
 * lands. The engine is given resolved legs either way, so nothing here changes
 * when the real one arrives.
 */
export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = { ...PLACEHOLDER_TRIP, slug };
  const days = await computeTrip(trip, createHaversineTravelProvider());

  return <TripWorkspace title={trip.title} days={days} />;
}
