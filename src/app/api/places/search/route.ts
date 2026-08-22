import { NextResponse } from "next/server";

/**
 * Place search is not connected yet. The handler exists so the route, the cache
 * table, and the rate limit all land in one place when the Google Places
 * adapter arrives. Until then it answers honestly instead of returning nothing.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      error: "Place search is not connected yet.",
      action: "Add a stop by dropping a pin on the map.",
    },
    { status: 501 },
  );
}
