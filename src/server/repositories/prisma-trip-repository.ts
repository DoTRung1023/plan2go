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
import { openingHoursToJson, parseOpeningHours } from "../places/opening-hours";
import { createTripSlug } from "../trips/slug";
import type {
  CreatedTrip,
  NewStop,
  NewTrip,
  SettingsUpdated,
  StopAdded,
  TripCleared,
  TripRepository,
  TripReset,
  TripSettingsUpdate,
} from "./trip-repository";

/** Two slugs colliding is a lottery win, so a handful of attempts is plenty. */
const SLUG_ATTEMPTS = 5;

const UNIQUE_CONSTRAINT = "P2002";

const TRAVEL_MODE_FROM_DB: Readonly<Record<DbTravelMode, TravelMode>> = {
  WALK: "walk",
  CYCLE: "cycle",
  DRIVE: "drive",
  TRANSIT: "transit",
};

const TRAVEL_MODE_TO_DB: Readonly<Record<TravelMode, DbTravelMode>> = {
  walk: "WALK",
  cycle: "CYCLE",
  drive: "DRIVE",
  transit: "TRANSIT",
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

  async findSlugByEditTokenHash(editTokenHash: string): Promise<string | null> {
    const row = await db.trip.findFirst({ where: { editTokenHash }, select: { slug: true } });
    return row === null ? null : row.slug;
  },

  async findPlaceByProviderId(slug: string, providerPlaceId: string): Promise<Place | null> {
    const row = await db.place.findFirst({
      where: { providerPlaceId, trip: { slug } },
    });
    return row === null ? null : toPlace(row);
  },

  async addStop(stop: NewStop): Promise<StopAdded> {
    const day = await db.day.findFirst({
      where: { id: stop.dayId, trip: { slug: stop.slug } },
      select: { id: true, tripId: true, _count: { select: { stops: true } } },
    });
    if (day === null) {
      return { status: "no-such-day" };
    }

    // The place carries the provider's identifier, not one of ours, so it is
    // matched on that rather than upserted by primary key.
    const existing =
      stop.place.providerPlaceId === null
        ? null
        : await db.place.findFirst({
            where: { tripId: day.tripId, providerPlaceId: stop.place.providerPlaceId },
            select: { id: true },
          });

    const place =
      existing ??
      (await db.place.create({
        data: {
          tripId: day.tripId,
          providerPlaceId: stop.place.providerPlaceId,
          name: stop.place.name,
          address: stop.place.address,
          lat: stop.place.position.lat,
          lng: stop.place.position.lng,
          openingHours: openingHoursToJson(stop.place.openingHours),
        },
        select: { id: true },
      }));

    await db.stop.create({
      data: {
        dayId: day.id,
        placeId: place.id,
        position: day._count.stops,
        stayMinutes: stop.stayMinutes,
        travelMode: TRAVEL_MODE_TO_DB[stop.travelMode],
      },
    });
    return { status: "added" };
  },

  async clear(reset: TripReset): Promise<TripCleared> {
    const trip = await db.trip.findUnique({
      where: { slug: reset.slug },
      select: { id: true },
    });
    if (trip === null) {
      return { status: "no-such-trip" };
    }

    // One transaction, and in this order. Deleting the days takes the stops
    // with them, which leaves the places unreferenced and safe to delete next.
    await db.$transaction([
      db.day.deleteMany({ where: { tripId: trip.id } }),
      db.place.deleteMany({ where: { tripId: trip.id } }),
      db.trip.update({
        where: { id: trip.id },
        data: { title: reset.title, timeZone: reset.timeZone },
      }),
      db.day.createMany({
        data: Array.from({ length: reset.dayCount }, (_unused, index) => ({
          tripId: trip.id,
          date: addDays(reset.startDate, index),
          position: index,
          startAtMinutes: reset.startAtMinutes,
        })),
      }),
    ]);

    return { status: "cleared" };
  },

  async updateSettings(update: TripSettingsUpdate): Promise<SettingsUpdated> {
    const trip = await db.trip.findUnique({
      where: { slug: update.slug },
      select: {
        id: true,
        days: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, date: true },
        },
      },
    });
    if (trip === null) {
      return { status: "no-such-trip" };
    }

    const kept = trip.days.filter((day) => day.position < update.dayCount);
    const dropped = trip.days.filter((day) => day.position >= update.dayCount);
    // Only the days whose date actually moves are written. Renaming a trip
    // moves none of them, and a row per day is a round trip per day.
    const moved = kept.filter(
      (day) => day.date !== addDays(update.startDate, day.position),
    );
    const added = Array.from(
      { length: Math.max(0, update.dayCount - trip.days.length) },
      (_unused, index) => {
        const position = trip.days.length + index;
        return {
          tripId: trip.id,
          date: addDays(update.startDate, position),
          position,
          startAtMinutes: update.startAtMinutes,
        };
      },
    );

    // One transaction, because a trip whose days half moved is not a trip.
    await db.$transaction([
      db.trip.update({
        where: { id: trip.id },
        data: { title: update.title },
      }),
      ...moved.map((day) =>
        db.day.update({
          where: { id: day.id },
          data: { date: addDays(update.startDate, day.position) },
        }),
      ),
      ...(dropped.length === 0
        ? []
        : [db.day.deleteMany({ where: { id: { in: dropped.map((day) => day.id) } } })]),
      ...(added.length === 0 ? [] : [db.day.createMany({ data: added })]),
    ]);

    return { status: "updated" };
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
