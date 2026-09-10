import { NextResponse } from "next/server";
import { z } from "zod";
import { computeTrip } from "@/features/day-planner/compute-trip";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import type { DrawnLeg } from "@/adapters/maps/google-static-map";
import { googleStaticMapUrl } from "@/adapters/maps/google-static-map";
import { staticMapImageFor, staticMapKey } from "@/server/maps/static-map-cache";
import { googleMapsApiKey } from "@/server/places/google-key";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { travelProvider } from "@/app/t/[slug]/travel";

/**
 * An open endpoint in front of a metered API. A trip exported whole asks for
 * one map per day, so the limit is set well above any trip and well below a
 * script.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 40 };

const ROUTE = "map-static";

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  day: z.string().min(1).max(40),
});

/**
 * Each leg of the day as it is travelled: its two ends and, where the chosen
 * way of covering it came with a shape, that shape.
 */
function drawnLegs(day: PlannedDay): readonly DrawnLeg[] {
  const points = [
    ...(day.plan.start === null ? [] : [day.plan.start.place.position]),
    ...day.plan.stops.map((stop) => stop.place.position),
    ...(day.plan.end === null ? [] : [day.plan.end.place.position]),
  ];
  return day.computed.legs.flatMap((leg) => {
    const from = points[leg.index];
    const to = points[leg.index + 1];
    const planned = day.legs[leg.index];
    if (from === undefined || to === undefined || planned === undefined) {
      return [];
    }
    const chosen = planned.options.find((option) => option.mode === planned.chosen);
    return [{ from, to, mode: leg.mode, path: chosen?.path ?? null }];
  });
}

/**
 * The map of one day, drawn for the printed page.
 *
 * A read, so no edit token is asked for: the slug is the whole of what lets
 * anyone see the trip, and the picture shows nothing the page does not. It
 * spends money, so it is limited by address and answered from our own table
 * when the same day was drawn recently.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many maps asked for from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and export again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      {
        error: "Maps are not switched on for this server.",
        action: "Export without the map.",
      },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That map could not be read.", action: "Export again." },
      { status: 400 },
    );
  }

  const trip = await prismaTripRepository.findBySlug(parsed.data.slug);
  const days = trip === null ? [] : await computeTrip(trip, travelProvider());
  const day = days.find((candidate) => candidate.plan.id === parsed.data.day);
  if (day === undefined) {
    return NextResponse.json(
      { error: "That day is not on this trip.", action: "Export again." },
      { status: 404 },
    );
  }

  const url = googleStaticMapUrl(day.plan, drawnLegs(day));
  try {
    const image = await staticMapImageFor(
      staticMapKey(url),
      async () => {
        const answer = await fetch(`${url}&key=${encodeURIComponent(apiKey)}`);
        if (!answer.ok) {
          throw new Error(`Static map answered ${String(answer.status)}`);
        }
        return {
          bytes: new Uint8Array(await answer.arrayBuffer()),
          contentType: answer.headers.get("content-type") ?? "image/png",
        };
      },
      new Date(),
    );
    return new NextResponse(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (cause) {
    // Kept in the function log so an upstream outage is diagnosable, and
    // turned into a sentence that says what the reader should do about it.
    console.error("Static map failed", cause);
    return NextResponse.json(
      {
        error: "Could not reach the map service.",
        action: "Your trip is saved. Export again in a moment, or without the map.",
      },
      { status: 502 },
    );
  }
}
