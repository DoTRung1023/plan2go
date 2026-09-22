import { NextResponse } from "next/server";
import { z } from "zod";
import { computeTrip } from "@/features/day-planner/compute-trip";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { dayMapImage } from "@/app/t/[slug]/day-map-image";
import { tripTravelProvider } from "@/app/t/[slug]/travel";

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

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That map could not be read.", action: "Export again." },
      { status: 400 },
    );
  }

  const trip = await prismaTripRepository.findBySlug(parsed.data.slug);
  const days = trip === null ? [] : await computeTrip(trip, await tripTravelProvider(trip));
  const day = days.find((candidate) => candidate.plan.id === parsed.data.day);
  if (day === undefined) {
    return NextResponse.json(
      { error: "That day is not on this trip.", action: "Export again." },
      { status: 404 },
    );
  }

  try {
    const image = await dayMapImage(day);
    if (image === null) {
      return NextResponse.json(
        {
          error: "Maps are not switched on for this server.",
          action: "Export without the map.",
        },
        { status: 503 },
      );
    }
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
