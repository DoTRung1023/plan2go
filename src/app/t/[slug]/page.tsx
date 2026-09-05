import { notFound } from "next/navigation";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { readEditTokens } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { TripEditor } from "./trip-editor";
import { travelProvider } from "./travel";

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
  const presentedTokens = await readEditTokens();

  // Two reads that do not need each other, so they are one wait rather than two.
  // The token question only decides whether to offer the controls that change
  // the trip, so a shared link still renders in full without one.
  const [trip, access] = await Promise.all([
    prismaTripRepository.findBySlug(slug),
    checkEditAccess({ slug, presentedTokens, repository: prismaTripRepository }),
  ]);

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
      canEdit={access.status === "granted"}
    />
  );
}
