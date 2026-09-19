import { cache } from "react";
import type { Trip } from "@/core/model/trip";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/**
 * The trip at this slug, read once per request. The page and its title both
 * need it, and without this each would ask the database on its own for the
 * same row.
 */
export const tripBySlug = cache(
  async (slug: string): Promise<Trip | null> => prismaTripRepository.findBySlug(slug),
);

/** What the browser's tab says: the trip's name, and plan2go when there is no trip to name. */
export async function tripTitle(slug: string): Promise<{ title: string }> {
  const trip = await tripBySlug(slug);
  return { title: trip === null ? "plan2go" : trip.title };
}
