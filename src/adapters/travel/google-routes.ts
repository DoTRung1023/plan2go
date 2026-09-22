import { z } from "zod";
import type {
  LegResolution,
  TransitRide,
  TransitVehicle,
  TravelMode,
  TravelRequest,
} from "@/core/model/leg";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { wholeMinutes } from "@/core/time/minutes";
import { decodePolyline } from "./polyline";

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * The two numbers the engine needs and the shape of the road they describe, so
 * the line drawn on the map is the route rather than the way the crow went.
 */
const ROUTE_FIELDS =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

/**
 * Asked for on public transport only: the steps of the route, which is where
 * the vehicles ridden are described. Nothing in them moves the request to a
 * dearer tier, and a walk or a drive has no vehicle to describe.
 */
const TRANSIT_FIELDS = "routes.legs.steps.staticDuration,routes.legs.steps.transitDetails";

const SECONDS_PER_MINUTE = 60;

/** What each of our modes is called over there. */
const ROUTES_MODE: Readonly<Record<TravelMode, string>> = {
  drive: "DRIVE",
  transit: "TRANSIT",
  walk: "WALK",
};

/** Google returns a duration as seconds with an "s" after them. */
const durationSchema = z.string().regex(/^\d+(\.\d+)?s$/);

const stepSchema = z.object({
  staticDuration: durationSchema.optional(),
  transitDetails: z
    .object({
      headsign: z.string().optional(),
      stopCount: z.number().int().nonnegative().optional(),
      stopDetails: z
        .object({
          departureStop: z.object({ name: z.string().optional() }).optional(),
          arrivalStop: z.object({ name: z.string().optional() }).optional(),
          /** When the vehicle leaves, as an RFC 3339 instant. */
          departureTime: z.string().optional(),
        })
        .optional(),
      transitLine: z
        .object({
          name: z.string().optional(),
          nameShort: z.string().optional(),
          vehicle: z.object({ type: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

/** One step of a route as Google describes it. Exported for the mapping's test. */
export type RouteStep = z.infer<typeof stepSchema>;

const routeSchema = z.object({
  duration: durationSchema,
  distanceMeters: z.number().int().nonnegative().optional(),
  polyline: z.object({ encodedPolyline: z.string() }).optional(),
  legs: z.array(z.object({ steps: z.array(stepSchema).optional() })).optional(),
});

/**
 * Google's vehicle types, folded to the handful the product draws. Anything
 * not listed is ridden all the same, so it is "other" rather than dropped.
 */
const VEHICLE: Readonly<Record<string, TransitVehicle>> = {
  BUS: "bus",
  INTERCITY_BUS: "bus",
  TROLLEYBUS: "bus",
  SHARE_TAXI: "bus",
  TRAM: "tram",
  CABLE_CAR: "tram",
  COMMUTER_TRAIN: "train",
  HEAVY_RAIL: "train",
  HIGH_SPEED_TRAIN: "train",
  LONG_DISTANCE_TRAIN: "train",
  METRO_RAIL: "train",
  MONORAIL: "train",
  RAIL: "train",
  SUBWAY: "train",
  FERRY: "ferry",
};

/** No route at all comes back as a 200 with nothing in it. */
const computeRoutesSchema = z.object({ routes: z.array(routeSchema).optional() });

export interface GoogleRoutesOptions {
  readonly apiKey: string;
}

/** "1234s" to whole minutes, which is the only unit the engine has. */
export function minutesFromDuration(duration: string): number {
  return wholeMinutes(Number.parseFloat(duration) / SECONDS_PER_MINUTE);
}

/**
 * The vehicles ridden, out of the steps of a public transport route. The walks
 * between them are left out: they are the way to the stop, and the total on
 * the route already counts them.
 */
export function ridesFromSteps(steps: readonly RouteStep[]): readonly TransitRide[] {
  const rides: TransitRide[] = [];
  for (const step of steps) {
    const transit = step.transitDetails;
    if (transit === undefined) {
      continue;
    }
    const line = transit.transitLine;
    rides.push({
      vehicle: VEHICLE[line?.vehicle?.type ?? ""] ?? "other",
      line: line?.nameShort ?? line?.name ?? null,
      headsign: transit.headsign ?? null,
      boardAt: transit.stopDetails?.departureStop?.name ?? null,
      alightAt: transit.stopDetails?.arrivalStop?.name ?? null,
      stops: transit.stopCount ?? null,
      durationMinutes:
        step.staticDuration === undefined ? 0 : minutesFromDuration(step.staticDuration),
    });
  }
  return rides;
}

/**
 * A leg nobody can cover this way. Not an error: driving to an island and
 * taking a train where there is no line are answers, and the engine carries
 * them as conflicts rather than as failures.
 */
const NO_ROUTE: LegResolution = { status: "unresolved", reason: "no-route" };

const UNAVAILABLE: LegResolution = {
  status: "unresolved",
  reason: "provider-unavailable",
};

const MILLIS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

/**
 * How far from now Google will look up a timetable: seven days back and a
 * hundred ahead, in its own words. A departure outside that is answered with
 * a 400, so one is not sent, and the answer is for the service running now.
 */
const TRANSIT_PAST_DAYS = 7;
const TRANSIT_FUTURE_DAYS = 100;

/**
 * The departure to send for a public transport leg, or null when none can be:
 * a leg with no known departure, or one further from now than the timetable
 * reaches. Only public transport is asked for a time. A walk takes as long as
 * it takes, and a drive is asked for without traffic, which is the tier whose
 * answer does not depend on the moment, so a time would be paid for and
 * ignored.
 */
export function transitDepartureFor(request: TravelRequest, now: Date): string | null {
  if (request.mode !== "transit" || request.departAt === null) {
    return null;
  }
  const nowMinutes = now.getTime() / MILLIS_PER_MINUTE;
  const daysAway = (request.departAt - nowMinutes) / MINUTES_PER_DAY;
  if (daysAway < -TRANSIT_PAST_DAYS || daysAway > TRANSIT_FUTURE_DAYS) {
    return null;
  }
  return new Date(request.departAt * MILLIS_PER_MINUTE).toISOString();
}

/**
 * The longest a traveller is taken to wait for the first vehicle before the
 * way is called no way at all. Asked for a bus on a Saturday afternoon where
 * the next one is Sunday morning, Google answers with that bus and a journey
 * of eighteen hours, which is an itinerary but not a way of getting there
 * that day. Two hours takes in a service every hour or so, which is a wait a
 * person can plan around, and nothing that is really tomorrow.
 */
const TRANSIT_WAIT_LIMIT_MINUTES = 120;

/**
 * How long the itinerary waits for its first vehicle after the moment asked
 * for, in minutes, or null when either is unknown: a request with no moment,
 * or steps with no vehicle on them.
 */
export function transitWaitMinutes(
  steps: readonly RouteStep[],
  departAt: number | null,
): number | null {
  if (departAt === null) {
    return null;
  }
  const first = steps.find((step) => step.transitDetails?.stopDetails?.departureTime !== undefined);
  const leaves = first?.transitDetails?.stopDetails?.departureTime;
  if (leaves === undefined) {
    return null;
  }
  const leavesAt = new Date(leaves).getTime();
  if (Number.isNaN(leavesAt)) {
    return null;
  }
  return Math.round(leavesAt / MILLIS_PER_MINUTE - departAt);
}

/**
 * Real routes from Google, called from the server only. The key is passed in
 * rather than read from the environment here, so this file has no opinion about
 * where secrets live.
 *
 * Two things this deliberately does not do. It never throws for a leg it cannot
 * answer, because one unreachable stop must not take down the page the rest of
 * the trip is on, and the engine already has a shape for an unanswered leg. And
 * it asks for roads without traffic, which is the cheapest tier and the only
 * one whose answer does not depend on the moment it was asked, so a cached row
 * stays true for longer than the minute it was written in. Public transport is
 * the exception: a timetable is a different thing at nine on a Sunday from
 * five on a Friday, so that is asked for at the moment the day sets out on it.
 */
export function createGoogleRoutesProvider(options: GoogleRoutesOptions): TravelProvider {
  return {
    name: "google-routes",

    async estimate(request: TravelRequest): Promise<LegResolution> {
      const travelMode = ROUTES_MODE[request.mode];
      const transit = request.mode === "transit";
      const departureTime = transitDepartureFor(request, new Date());
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": options.apiKey,
        "X-Goog-FieldMask": transit ? `${ROUTE_FIELDS},${TRANSIT_FIELDS}` : ROUTE_FIELDS,
      };

      const body = {
        origin: {
          location: {
            latLng: { latitude: request.from.lat, longitude: request.from.lng },
          },
        },
        destination: {
          location: { latLng: { latitude: request.to.lat, longitude: request.to.lng } },
        },
        travelMode,
        ...(travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
        ...(departureTime === null ? {} : { departureTime }),
      };

      let response: Response;
      try {
        response = await fetch(COMPUTE_ROUTES_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch {
        // The network, or Google, is down. The trip is still readable without
        // this one number, so it is unresolved rather than thrown.
        return UNAVAILABLE;
      }

      // A 4xx is our bug: a malformed body, or a key that is not allowed to ask.
      // Those must be seen rather than silently degraded into "unavailable".
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Google Routes answered ${String(response.status)} for a ${request.mode} leg.`,
        );
      }
      if (!response.ok) {
        return UNAVAILABLE;
      }

      const parsed = computeRoutesSchema.parse(await response.json());
      const route = parsed.routes?.[0];
      if (route === undefined) {
        return NO_ROUTE;
      }
      const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];

      // A vehicle that leaves hours after the moment asked for is the next
      // day's service, or as good as, and that is no way of getting there at
      // this time rather than a very long one.
      const wait = transit ? transitWaitMinutes(steps, request.departAt) : null;
      if (wait !== null && wait > TRANSIT_WAIT_LIMIT_MINUTES) {
        return NO_ROUTE;
      }

      return {
        status: "resolved",
        estimate: {
          mode: request.mode,
          durationMinutes: minutesFromDuration(route.duration),
          distanceMeters: route.distanceMeters ?? 0,
          source: "google-routes",
          path:
            route.polyline === undefined
              ? null
              : decodePolyline(route.polyline.encodedPolyline),
          rides: transit ? ridesFromSteps(steps) : null,
        },
      };
    },
  };
}
