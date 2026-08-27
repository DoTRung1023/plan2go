import { notFound } from "next/navigation";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { readEditToken } from "@/server/ownership/edit-token-cookie";
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

  // The read above did not need a token. This only decides whether to offer the
  // controls that change the trip, so a shared link still renders in full.
  const access = await checkEditAccess({
    slug,
    presentedToken: await readEditToken(),
    repository: prismaTripRepository,
  });

  return (
    <TripWorkspace
      title={trip.title}
      slug={trip.slug}
      days={days}
      canEdit={access.status === "granted"}
    />
  );
}
