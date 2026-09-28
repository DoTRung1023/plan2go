import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { placeCardFor } from "@/server/places/place-card";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { placesRead } from "../places-read";

/**
 * A card is asked for once per place opened, and a person opens a handful of
 * places in a sitting. Anything asking more often is not a person.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  id: z.string().min(1).max(300),
  /** The edit key, from whoever is looking at a place before putting it on the day. */
  key: z.string().min(1).max(200).optional(),
});

/**
 * What a place is like. A read, so anyone holding the plain link may look at
 * a place that is on the trip. A place that is not on it yet may be looked
 * at by whoever holds the edit key, since they are the one deciding whether
 * to add it and could add it and look regardless; without the key the place
 * has to be on the trip, which is what stops this being a way to look up any
 * place in the world on our account.
 */
export const GET = placesRead({
  route: "places-card",
  policy: POLICY,
  asking: { many: "places opened", again: "open it again", service: "place service" },
  query: querySchema,
  failing: "Place card failed",
  answer: async ({ slug, id, key }, provider) => {
    const onTrip = await prismaTripRepository.findPlaceByProviderId(slug, id);
    if (onTrip === null) {
      const access =
        key === undefined
          ? null
          : await checkEditAccess({ slug, presentedKey: key, repository: prismaTripRepository });
      if (access?.status !== "granted") {
        return NextResponse.json({ error: "That place is not on this trip." }, { status: 404 });
      }
    }

    const card = await placeCardFor(id, provider);
    if (card === null) {
      return NextResponse.json(
        { error: "Nothing more is known about this place." },
        { status: 404 },
      );
    }
    return NextResponse.json({ card });
  },
});
