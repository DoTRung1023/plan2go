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
  LegModeSet,
  LegModeUpdate,
  NewStop,
  StopChanged,
  StopMove,
  StopRemoval,
  StopUpdate,
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

/** Higher than any day could hold, so a reorder never collides mid flight. */
const PARKING_OFFSET = 1000;

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

/** The date is the trip's first day plus this day's position, never a column. */
function toDay(row: DayRow, timeZone: string, startDate: string): DayPlan {
  return {
    id: row.id,
    date: addDays(startDate, row.position),
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
    days: row.days.map((day) => toDay(day, row.timeZone, row.startDate)),
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
      startDate: trip.startDate,
      editTokenHash: trip.editTokenHash,
      days: {
        create: Array.from({ length: trip.dayCount }, (_unused, index) => ({
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
    // One query with joins rather than one per level of the include. A trip is
    // four levels deep, and every page load reads it.
    const row = await db.trip.findUnique({
      where: { slug },
      include: tripInclude,
      relationLoadStrategy: "join",
    });
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
    // Scoped to the tokens the browser holds, so finding the day is also the
    // check that this trip may be changed.
    const day = await db.day.findFirst({
      where: {
        id: stop.dayId,
        trip: { slug: stop.slug, editTokenHash: { in: [...stop.editTokenHashes] } },
      },
      select: { id: true, tripId: true, _count: { select: { stops: true } } },
    });
    if (day === null) {
      return { status: "refused" };
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

  async setLegMode(update: LegModeUpdate): Promise<LegModeSet> {
    // Scoped to the tokens the browser holds, so finding the day is also the
    // check that this trip may be changed.
    const day = await db.day.findFirst({
      where: {
        id: update.dayId,
        trip: { slug: update.slug, editTokenHash: { in: [...update.editTokenHashes] } },
      },
      select: { id: true },
    });
    if (day === null) {
      return { status: "refused" };
    }

    const mode = TRAVEL_MODE_TO_DB[update.mode];

    if (update.stopId === null) {
      await db.day.update({ where: { id: day.id }, data: { endTravelMode: mode } });
      return { status: "set" };
    }

    // Scoped to the day as well as the stop, so a stop id from another trip
    // updates nothing rather than being taken on trust.
    const changed = await db.stop.updateMany({
      where: { id: update.stopId, dayId: day.id },
      data: { travelMode: mode },
    });
    return changed.count === 0 ? { status: "refused" } : { status: "set" };
  },

  async updateStop(update: StopUpdate): Promise<StopChanged> {
    // Scoped to the tokens the browser holds, so finding the stop is also the
    // check that this trip may be changed.
    const changed = await db.stop.updateMany({
      where: {
        id: update.stopId,
        day: {
          trip: { slug: update.slug, editTokenHash: { in: [...update.editTokenHashes] } },
        },
      },
      data: {
        ...(update.stayMinutes === undefined ? {} : { stayMinutes: update.stayMinutes }),
        ...(update.note === undefined ? {} : { note: update.note }),
      },
    });
    return changed.count === 0 ? { status: "refused" } : { status: "changed" };
  },

  async removeStop(removal: StopRemoval): Promise<StopChanged> {
    const stop = await db.stop.findFirst({
      where: {
        id: removal.stopId,
        day: {
          trip: { slug: removal.slug, editTokenHash: { in: [...removal.editTokenHashes] } },
        },
      },
      select: { id: true, dayId: true, position: true },
    });
    if (stop === null) {
      return { status: "refused" };
    }

    // The stops after it close the gap in the same transaction, so a day is
    // never briefly missing a position and the next stop added lands at the end
    // rather than on top of an existing one.
    await db.$transaction([
      db.stop.delete({ where: { id: stop.id } }),
      db.stop.updateMany({
        where: { dayId: stop.dayId, position: { gt: stop.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
    return { status: "changed" };
  },

  async moveStop(move: StopMove): Promise<StopChanged> {
    const stop = await db.stop.findFirst({
      where: {
        id: move.stopId,
        day: {
          trip: { slug: move.slug, editTokenHash: { in: [...move.editTokenHashes] } },
        },
      },
      select: { id: true, dayId: true, position: true },
    });
    if (stop === null) {
      return { status: "refused" };
    }

    const order = await db.stop.findMany({
      where: { dayId: stop.dayId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const from = order.findIndex((row) => row.id === stop.id);
    const to = Math.max(0, Math.min(move.toPosition, order.length - 1));
    if (from === -1 || from === to) {
      return { status: "changed" };
    }

    const moved = order.slice();
    const [taken] = moved.splice(from, 1);
    if (taken === undefined) {
      return { status: "changed" };
    }
    moved.splice(to, 0, taken);

    // Two passes, because a day's positions are unique: everything is parked
    // out of the way first, so no row on its way to its new place lands on one
    // that has not moved yet.
    const parked = moved.map((row, index) =>
      db.stop.update({
        where: { id: row.id },
        data: { position: index + PARKING_OFFSET },
      }),
    );
    const settled = moved.map((row, index) =>
      db.stop.update({ where: { id: row.id }, data: { position: index } }),
    );
    await db.$transaction([...parked, ...settled]);

    return { status: "changed" };
  },

  async clear(reset: TripReset): Promise<TripCleared> {
    // Scoped to the tokens the browser holds, so the read that finds the trip is
    // also the check that it may be changed. Nothing comes back for a trip that
    // is not there and nothing comes back for one that is not theirs, which is
    // the same answer we would have given anyway.
    const trip = await db.trip.findFirst({
      where: { slug: reset.slug, editTokenHash: { in: [...reset.editTokenHashes] } },
      select: { id: true },
    });
    if (trip === null) {
      return { status: "refused" };
    }

    // One transaction, and in this order. Deleting the days takes the stops
    // with them, which leaves the places unreferenced and safe to delete next.
    await db.$transaction([
      db.day.deleteMany({ where: { tripId: trip.id } }),
      db.place.deleteMany({ where: { tripId: trip.id } }),
      db.trip.update({
        where: { id: trip.id },
        data: {
          title: reset.title,
          timeZone: reset.timeZone,
          startDate: reset.startDate,
        },
      }),
      db.day.createMany({
        data: Array.from({ length: reset.dayCount }, (_unused, index) => ({
          tripId: trip.id,
          position: index,
          startAtMinutes: reset.startAtMinutes,
        })),
      }),
    ]);

    return { status: "cleared" };
  },

  async updateSettings(update: TripSettingsUpdate): Promise<SettingsUpdated> {
    const trip = await db.trip.findFirst({
      where: { slug: update.slug, editTokenHash: { in: [...update.editTokenHashes] } },
      select: { id: true, _count: { select: { days: true } } },
    });
    if (trip === null) {
      return { status: "refused" };
    }

    const had = trip._count.days;
    // Every day's date is the trip's start date plus its position, so moving the
    // trip moves all of them by writing one column. Only a change of length
    // touches the days themselves, and then only the ones at the end.
    const added = Array.from({ length: Math.max(0, update.dayCount - had) }, (_unused, index) => ({
      tripId: trip.id,
      position: had + index,
      startAtMinutes: update.startAtMinutes,
    }));

    // One transaction, because a trip whose days half moved is not a trip.
    await db.$transaction([
      db.trip.update({
        where: { id: trip.id },
        data: { title: update.title, startDate: update.startDate },
      }),
      ...(update.dayCount >= had
        ? []
        : [
            db.day.deleteMany({
              where: { tripId: trip.id, position: { gte: update.dayCount } },
            }),
          ]),
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
