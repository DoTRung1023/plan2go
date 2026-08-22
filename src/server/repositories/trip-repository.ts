import type { Trip } from "@/core/model/trip";

/**
 * The contract between the app and storage. Only the read path exists so far,
 * mutations arrive with the sprint that lets a stop be added. Implementations
 * translate Prisma rows into the core model, so nothing above this line ever
 * sees a Prisma type.
 */
export interface TripRepository {
  findBySlug(slug: string): Promise<Trip | null>;
}
