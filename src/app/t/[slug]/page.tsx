import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PLACEHOLDER_TRIP } from "@/features/day-planner/placeholder-trip";

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

  return <DayPlanner title={trip.title} days={days} />;
}
