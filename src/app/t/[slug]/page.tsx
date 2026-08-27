import { notFound } from "next/navigation";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { TripWorkspace } from "./trip-workspace";

/**
 * A read, so no edit token is asked for. Anyone with the link sees the trip.
 *
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
  const trip = await prismaTripRepository.findBySlug(slug);

  if (trip === null) {
    notFound();
  }

  const days = await computeTrip(trip, createHaversineTravelProvider());
  return <TripWorkspace title={trip.title} days={days} />;
}
