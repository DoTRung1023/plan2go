import { NextResponse } from "next/server";

/**
 * Travel times are computed in the browser session from the haversine provider
 * until the Google Routes adapter lands behind this handler, with its own cache
 * table and per IP rate limit.
 */
export function POST(): NextResponse {
  return NextResponse.json(
    {
      error: "Live travel times are not connected yet.",
      action: "Times shown in the planner are straight line estimates.",
    },
    { status: 501 },
  );
}
