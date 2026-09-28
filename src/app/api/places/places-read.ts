import { NextResponse } from "next/server";
import type { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import type { PlacesProvider } from "@/core/ports/places-provider";
import { googleMapsApiKey } from "@/server/places/google-key";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";

/**
 * The words a route's refusals use for what the reader was doing, where one
 * route's differ from the next: "Too many `searches` from this connection.
 * Wait 30 seconds and `search again`." and "Could not reach the `place search
 * service`."
 */
interface Asking {
  readonly many: string;
  readonly again: string;
  readonly service: string;
}

interface PlacesRead<Query> {
  /** What its requests are counted under, and how many one connection may make. */
  readonly route: string;
  readonly policy: RateLimitPolicy;
  readonly asking: Asking;
  /** The query string, as the route reads it. */
  readonly query: z.ZodType<Query>;
  /** What the function log calls the provider failing, so an outage can be told apart. */
  readonly failing: string;
  /** The reply to a request that was allowed, and read. */
  readonly answer: (query: Query, provider: PlacesProvider) => Promise<NextResponse>;
}

/** A refusal, which says what happened and then what to do. */
export function refuse(
  status: number,
  error: string,
  action: string,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ error, action }, { status, headers });
}

/**
 * A read in front of the places provider: a route that asks for no edit
 * token, since reads never do, but spends money, so it is counted by address
 * before anything else and refused plainly when the server has no key.
 * Nothing the answer reads, our own tables included, is read before the
 * count, so a connection over its limit costs the database only the count.
 *
 * Every places route that answers in words comes through here, so the shape
 * of a refusal and the order things are checked in are written once.
 *
 * Every refusal says what happened and what to do. Whether the reader hears
 * it is the caller's to decide: a list nobody asked for out loud, such as the
 * one an empty field offers, shows nothing instead.
 */
export function placesRead<Query>(
  read: PlacesRead<Query>,
): (request: Request) => Promise<NextResponse> {
  return async (request) => {
    const limit = await consumeRateLimit(read.route, request.headers, read.policy);
    if (!limit.allowed) {
      const wait = String(limit.retryAfterSeconds);
      return refuse(
        429,
        `Too many ${read.asking.many} from this connection.`,
        `Wait ${wait} seconds and ${read.asking.again}.`,
        { "Retry-After": wait },
      );
    }

    const apiKey = googleMapsApiKey();
    if (apiKey === null) {
      return refuse(
        503,
        "Place search is not switched on for this server.",
        "Add a stop by dropping a pin on the map.",
      );
    }

    const parsed = read.query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return refuse(400, "That request could not be read.", "Reload the page and try again.");
    }

    try {
      return await read.answer(parsed.data, createGooglePlacesProvider({ apiKey }));
    } catch (cause) {
      // Kept in the function log so an upstream outage is diagnosable, and
      // turned into a sentence that says what the reader should do about it.
      console.error(read.failing, cause);
      return refuse(
        502,
        `Could not reach the ${read.asking.service}.`,
        "Your trip is saved, try again in a moment.",
      );
    }
  };
}
