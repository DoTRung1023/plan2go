import type {
  Day,
  Place as PlaceRow,
  Prisma,
  Stop as StopRow,
  TravelMode as DbTravelMode,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { Trip } from "@/core/model/trip";
import { addDays } from "@/core/time/zoned";
import { db } from "../db";
import { parseOpeningHours } from "../places/opening-hours";
import { createTripSlug } from "../trips/slug";
import type { CreatedTrip, NewTrip, TripRepository } from "./trip-repository";

/** Two slugs colliding is a lottery win, so a handful of attempts is plenty. */
const SLUG_ATTEMPTS = 5;

const UNIQUE_CONSTRAINT = "P2002";

const TRAVEL_MODE_FROM_DB: Readonly<Record<DbTravelMode, TravelMode>> = {
  WALK: "walk",
  CYCLE: "cycle",
  DRIVE: "drive",
  TRANSIT: "transit",
};

const tripInclude = {
  days: {
    orderBy: { position: "asc" },
    include: {
      startPlace: true,
      endPlace: true,
      stops: { orderBy: { position: "asc" }, include: { place: true } },
    },
  },
} satisfies Prisma.TripInclude;

type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;
type DayRow = Day & {
  startPlace: PlaceRow | null;
  endPlace: PlaceRow | null;
  stops: (StopRow & { place: PlaceRow })[];
};

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    providerPlaceId: row.providerPlaceId,
    name: row.name,
    address: row.address,
    position: { lat: row.lat, lng: row.lng },
    openingHours: parseOpeningHours(row.openingHours),
  };
}

function toStop(row: StopRow & { place: PlaceRow }): Stop {
  return {
    id: row.id,
    place: toPlace(row.place),
    stayMinutes: row.stayMinutes,
    travelMode: TRAVEL_MODE_FROM_DB[row.travelMode],
    note: row.note,
  };
}

function toEndpoint(place: PlaceRow | null, label: string | null): DayEndpoint | null {
  if (place === null) {
    return null;
  }
  return { place: toPlace(place), label };
}

function toDay(row: DayRow, timeZone: string): DayPlan {
  return {
    id: row.id,
    date: row.date,
    timeZone,
    label: row.label,
    start: toEndpoint(row.startPlace, row.startLabel),
    end: toEndpoint(row.endPlace, row.endLabel),
    startAtMinutes: row.startAtMinutes,
    stops: row.stops.map(toStop),
    endTravelMode: TRAVEL_MODE_FROM_DB[row.endTravelMode],
  };
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    timeZone: row.timeZone,
    userId: row.userId,
    days: row.days.map((day) => toDay(day, row.timeZone)),
  };
}

function isSlugTaken(error: unknown): boolean {
  return (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT
  );
}

async function insert(trip: NewTrip, slug: string): Promise<CreatedTrip> {
  const created = await db.trip.create({
    data: {
      slug,
      title: trip.title,
      timeZone: trip.timeZone,
      editTokenHash: trip.editTokenHash,
      days: {
        create: Array.from({ length: trip.dayCount }, (_unused, index) => ({
          date: addDays(trip.startDate, index),
          position: index,
          startAtMinutes: trip.startAtMinutes,
        })),
      },
    },
    select: { slug: true },
  });
  return { slug: created.slug };
}

/**
 * The only place in the app that knows Prisma exists. Everything it returns is
 * a core model type.
 */
export const prismaTripRepository: TripRepository = {
  async findBySlug(slug: string): Promise<Trip | null> {
    const row = await db.trip.findUnique({ where: { slug }, include: tripInclude });
    return row === null ? null : toTrip(row);
  },

  async findEditTokenHash(slug: string): Promise<string | null> {
    const row = await db.trip.findUnique({ where: { slug }, select: { editTokenHash: true } });
    return row === null ? null : row.editTokenHash;
  },

  async create(trip: NewTrip): Promise<CreatedTrip> {
    let lastCollision: unknown = new Error("Could not allocate a trip slug.");
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      try {
        return await insert(trip, createTripSlug());
      } catch (error) {
        if (!isSlugTaken(error)) {
          throw error;
        }
        lastCollision = error;
      }
    }
    throw lastCollision;
  },
};
