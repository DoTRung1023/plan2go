import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CITIES_TO_VISIT_POLICY,
  CITIES_TO_VISIT_ROUTE,
  citiesToVisit,
} from "@/server/places/cities-to-visit";
import { placesRead, refuse } from "../places-read";

/**
 * The towns near a city and the cities in its country come to twenty at
 * most, and more than that would be names nobody scrolls to.
 */
const MOST_ASKED = 20;

const querySchema = z.object({
  city: z.string().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(MOST_ASKED).default(MOST_ASKED),
});

/**
 * The cities worth going to from a day's city, the towns near it and the best
 * known cities in its country, nearest first. A read, and the city is a
 * provider identifier that says nothing about anybody, so there is nothing
 * here to guard beyond the spend.
 *
 * Counted with the working out done ahead when a day is put in a city, so
 * there is one budget for the list however it is reached. A refusal leaves
 * the list from the last opening on the panel.
 */
export const GET = placesRead({
  route: CITIES_TO_VISIT_ROUTE,
  policy: CITIES_TO_VISIT_POLICY,
  asking: { many: "searches", again: "try again", service: "place search service" },
  query: querySchema,
  failing: "Cities to visit failed",
  answer: async ({ city, limit }, provider) => {
    const cities = await citiesToVisit(city, limit, provider);
    return cities === null
      ? refuse(404, "That city could not be found.", "Choose the city again.")
      : NextResponse.json({ cities });
  },
});
