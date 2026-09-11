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

/**
 * Real routes from Google, called from the server only. The key is passed in
 * rather than read from the environment here, so this file has no opinion about
 * where secrets live.
 *
 * Two things this deliberately does not do. It never throws for a leg it cannot
 * answer, because one unreachable stop must not take down the page the rest of
 * the trip is on, and the engine already has a shape for an unanswered leg. And
 * it asks for routes without traffic, which is the cheapest tier and the only
 * one whose answer does not depend on the moment it was asked, so a cached row
 * stays true for longer than the minute it was written in.
 */
export function createGoogleRoutesProvider(options: GoogleRoutesOptions): TravelProvider {
  return {
    name: "google-routes",

    async estimate(request: TravelRequest): Promise<LegResolution> {
      const travelMode = ROUTES_MODE[request.mode];
      const transit = request.mode === "transit";
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
          rides: transit
            ? ridesFromSteps(route.legs?.flatMap((leg) => leg.steps ?? []) ?? [])
            : null,
        },
      };
    },
  };
}
