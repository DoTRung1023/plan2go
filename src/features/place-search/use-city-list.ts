"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/core/model/place";
import type { PlaceKind } from "@/core/model/place-kind";
import type { Answer, Suggestion } from "./search-api";
import { askForPlaces, POINT_DECIMALS } from "./search-api";

/**
 * The city's best known asked for, of one kind or of any, which is more than
 * are shown. What the trip already holds comes out of the list each time it
 * is drawn, and the next in line takes its place, so the list stays the same
 * length for as long as there is anything left to fill it from. This is
 * every place the provider will name for one question and it costs no more
 * than asking for six, so the whole of it is asked for at once: a traveller
 * who has taken fourteen of a city's best known places has been offered the
 * lot, and there is no page after this one.
 */
const ASKED = 20;

/**
 * The best known places in the city, of one kind or, with none, of any. A
 * kind was asked for out loud, with a press, so its refusal comes back as the
 * sentence the panel shows. Nobody asked for the city's best known, so its
 * refusal is an empty list, and the field says nothing about a list it never
 * requested.
 */
async function askAboutCity(kind: PlaceKind | null, city: LatLng): Promise<Answer<Suggestion>> {
  const parameters = new URLSearchParams({
    lat: city.lat.toFixed(POINT_DECIMALS),
    lng: city.lng.toFixed(POINT_DECIMALS),
    limit: String(ASKED),
  });
  if (kind !== null) {
    parameters.set("kind", kind);
  }
  const answer = await askForPlaces("/api/places/nearby", parameters);
  return kind === null && "error" in answer ? { found: [] } : answer;
}

/**
 * The list about the city the empty field offers: what it is known for, or
 * the best known of the kind a quick search picked. Undefined until it has
 * answered, and when there is no city to ask about.
 *
 * Asked when it is `wanted`, the panel open on an empty field, and not on
 * mounting: the call is metered, and a reader who types straight away should
 * never cause it. Each list is asked about once for each city, so going back
 * to one already looked at is instant, and a day in the next city of the trip
 * is asked about afresh. A refusal is not kept as asked, so asking again,
 * pressing the kind again, asks again.
 */
export function useCityList(
  kind: PlaceKind | null,
  city: LatLng | null,
  wanted: boolean,
): Answer<Suggestion> | undefined {
  const [answers, setAnswers] = useState<Readonly<Record<string, Answer<Suggestion>>>>({});
  /**
   * The lists asked about, by the same key as their answers. A ref rather than
   * state, because the effect that asks may not set state on the way in, only
   * in the answer.
   */
  const asked = useRef(new Set<string>());

  const lat = city?.lat ?? null;
  const lng = city?.lng ?? null;
  const key =
    lat === null || lng === null
      ? null
      : `${kind ?? "popular"}@${lat.toFixed(POINT_DECIMALS)},${lng.toFixed(POINT_DECIMALS)}`;

  useEffect(() => {
    if (!wanted || key === null || lat === null || lng === null || asked.current.has(key)) {
      return;
    }
    asked.current.add(key);
    void askAboutCity(kind, { lat, lng }).then((answer) => {
      if ("error" in answer) {
        asked.current.delete(key);
      }
      setAnswers((now) => ({ ...now, [key]: answer }));
    });
  }, [wanted, key, kind, lat, lng]);

  return key === null ? undefined : answers[key];
}
