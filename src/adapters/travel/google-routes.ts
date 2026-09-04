import { z } from "zod";
import type { LegResolution, TravelMode, TravelRequest } from "@/core/model/leg";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { wholeMinutes } from "@/core/time/minutes";

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/** The two numbers the engine needs, and nothing we are not going to use. */
const ROUTE_FIELDS = "routes.duration,routes.distanceMeters";

const SECONDS_PER_MINUTE = 60;

/**
 * What each of our modes is called over there. Flying is missing on purpose:
 * the Routes API covers ways of getting somewhere on the ground, and Google's
 * flight search is a different product that is not part of it.
 */
const ROUTES_MODE: Readonly<Record<TravelMode, string | null>> = {
  drive: "DRIVE",
  transit: "TRANSIT",
  walk: "WALK",
  cycle: "BICYCLE",
  flight: null,
};

/** Google returns a duration as seconds with an "s" after them. */
const durationSchema = z.string().regex(/^\d+(\.\d+)?s$/);

const routeSchema = z.object({
  duration: durationSchema,
  distanceMeters: z.number().int().nonnegative().optional(),
});

/** No route at all comes back as a 200 with nothing in it. */
const computeRoutesSchema = z.object({ routes: z.array(routeSchema).optional() });

export interface GoogleRoutesOptions {
  readonly apiKey: string;
  /**
   * Answers the modes the Routes API does not cover, which is flying. Its
   * estimates carry their own source, so an answer that was worked out rather
   * than looked up can still be told apart downstream.
   */
  readonly forModesItCannotAnswer: TravelProvider;
}

/** "1234s" to whole minutes, which is the only unit the engine has. */
export function minutesFromDuration(duration: string): number {
  return wholeMinutes(Number.parseFloat(duration) / SECONDS_PER_MINUTE);
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
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": options.apiKey,
    "X-Goog-FieldMask": ROUTE_FIELDS,
  };

  return {
    name: "google-routes",

    async estimate(request: TravelRequest): Promise<LegResolution> {
      const travelMode = ROUTES_MODE[request.mode];
      if (travelMode === null) {
        return options.forModesItCannotAnswer.estimate(request);
      }

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
      // Those must be seen rather than silently degraded into "not known".
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
        },
      };
    },
  };
}
