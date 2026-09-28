import type { LandmarkPlace, PlaceSuggestion, PlacesProvider } from "@/core/ports/places-provider";
import { placeDetailsFor } from "./place-details";
import { suggestionsFor } from "./suggestion-cache";

/** Landmarks asked for, which is as many as one text search answers with. */
const LANDMARKS_ASKED = 20;

/**
 * The question has no words of its own beyond the country, so it is filed
 * under a fixed name and told apart by the country, which goes where a
 * typed search keeps its bias point. Every trip to a country asks the same
 * question, and the second of them costs nothing.
 */
const QUERY_KEY = "cities:popular";

/**
 * A name as it is compared: without its accents, with the Vietnamese đ as the
 * d it is written as without them, in lower case, and without the word the
 * provider sometimes adds to a province, so "Huế" and "Hue", and "Quang Binh
 * Province" and "Quảng Bình", are one region.
 */
function folded(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+province$/, "")
    .trim();
}

/**
 * The cities a country's landmarks are in, the best known first.
 *
 * A landmark's address names its town or city when it names one and its
 * province when it does not, which is Hanoi's Old Quarter, filed under the
 * city of Hanoi as a province. A great city is filed the other way round:
 * Tokyo's landmarks each name their own ward, and read one by one they are
 * six cities nobody has heard of. So a province whose landmarks name more
 * than one town is taken to be the city itself, and otherwise a landmark is
 * in the town it names or, naming none, in its province.
 *
 * Ranked by how many landmarks are in each, and after that by which came up
 * first, since the provider ranks the landmarks and that ranking is worth
 * keeping. Names only: which city each one actually is gets asked afterwards.
 */
export function citiesFromLandmarks(
  landmarks: readonly LandmarkPlace[],
  limit: number,
): readonly string[] {
  const townsIn = new Map<string, Set<string>>();
  for (const landmark of landmarks) {
    if (landmark.region !== null && landmark.locality !== null) {
      const region = folded(landmark.region);
      const towns = townsIn.get(region) ?? new Set<string>();
      towns.add(folded(landmark.locality));
      townsIn.set(region, towns);
    }
  }

  const votes = new Map<string, { name: string; count: number; first: number }>();
  landmarks.forEach((landmark, at) => {
    const region = landmark.region === null ? null : folded(landmark.region);
    const name =
      landmark.region !== null && region !== null && (townsIn.get(region)?.size ?? 0) > 1
        ? landmark.region
        : (landmark.locality ?? landmark.region);
    if (name === null) {
      return;
    }
    const key = folded(name);
    const counted = votes.get(key);
    votes.set(key, counted === undefined ? { name, count: 1, first: at } : { ...counted, count: counted.count + 1 });
  });

  return [...votes.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, limit)
    .map((vote) => vote.name);
}

/** The country an address ends in, "Vietnam" from "Hanoi, Ha Noi, Vietnam". */
export function countryOf(address: string | null): string | null {
  const last = address?.split(",").at(-1)?.trim() ?? "";
  return last === "" ? null : last;
}

export interface PopularCities {
  readonly country: string;
  readonly cities: readonly PlaceSuggestion[];
}

/**
 * The cities worth visiting in the country a city is in, as cities the
 * provider can name, for the picker nobody has typed in yet.
 *
 * Asked in three steps, all but the last kept in our own tables: the city,
 * for its country; the country's landmarks, for the cities they are in; and
 * each of those names as a city search, so every row is a city with the
 * provider's own identifier and the line under its name, and two spellings
 * of one city come back as one. Null when the city has no country to go on.
 */
export async function popularCities(
  cityPlaceId: string,
  limit: number,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<PopularCities | null> {
  const city = await placeDetailsFor(cityPlaceId, provider, null, now);
  const country = countryOf(city?.address ?? null);
  if (country === null) {
    return null;
  }

  const cities = await suggestionsFor(
    { query: QUERY_KEY, biasKey: country, size: limit },
    async () => {
      const landmarks = await provider.landmarks({
        query: `best cities to visit in ${country}`,
        limit: LANDMARKS_ASKED,
      });
      const named = await Promise.all(
        citiesFromLandmarks(landmarks, limit).map((name) =>
          provider.search({
            query: `${name}, ${country}`,
            near: null,
            limit: 1,
            citiesOnly: true,
            session: null,
          }),
        ),
      );
      const found: PlaceSuggestion[] = [];
      for (const [first] of named) {
        if (first !== undefined && !found.some((one) => one.providerPlaceId === first.providerPlaceId)) {
          found.push(first);
        }
      }
      return found;
    },
    now,
  );

  return { country, cities };
}
