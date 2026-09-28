import type { CompassPoint } from "@/core/model/distance";
import { compassPoint, metersBetween } from "@/core/model/distance";
import type { LatLng } from "@/core/model/place";
import type { LandmarkPlace, PlaceSuggestion, PlacesProvider } from "@/core/ports/places-provider";
import { placeDetailsFor } from "./place-details";
import { suggestionsFor } from "./suggestion-cache";

/** Landmarks asked for, which is as many as one text search answers with. */
const LANDMARKS_ASKED = 20;

/**
 * Neither question has words of its own beyond the place it is about, so each
 * is filed under a fixed name and told apart by the place, which goes where a
 * typed search keeps its bias point: the country for its best known cities,
 * and the city for the towns near it. Every trip to a country asks the same
 * first question, every trip to a city the same second one, and the second
 * time either is asked it costs nothing.
 */
const POPULAR_KEY = "cities:popular";
const NEARBY_KEY = "cities:nearby";

/** The best known cities in the country, kept and looked up. */
const POPULAR_KEPT = 10;

/** The towns near the city, kept and looked up. */
const NEARBY_KEPT = 10;

/**
 * Closer than this is the city itself: its suburbs, and the district a
 * landmark in its middle is filed under. Nobody moves a day of the trip to go
 * somewhere a bus ride from where they are staying.
 */
const NEAREST_METERS = 15_000;

/**
 * A name as it is compared: without its accents, with the Vietnamese đ as the
 * d it is written as without them, in lower case, without the word the
 * provider sometimes adds to a province, and without its spaces, so "Huế" and
 * "Hue", "Quang Binh Province" and "Quảng Bình", and "Hà Nội" and "Hanoi" are
 * one place.
 */
function folded(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+province$/, "")
    .replace(/\s+/g, "")
    .trim();
}

interface Vote {
  readonly name: string;
  readonly count: number;
  readonly first: number;
}

/** One more landmark for a place, which is the first it came up at if it is new. */
function vote(votes: Map<string, Vote>, name: string, at: number): void {
  const key = folded(name);
  const counted = votes.get(key);
  votes.set(key, counted === undefined ? { name, count: 1, first: at } : { ...counted, count: counted.count + 1 });
}

/**
 * Ranked by how many landmarks are in each, and after that by which came up
 * first, since the provider ranks the landmarks and that ranking is worth
 * keeping.
 */
function ranked(votes: ReadonlyMap<string, Vote>, limit: number): readonly string[] {
  return [...votes.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, limit)
    .map((counted) => counted.name);
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
 * Names only: which city each one actually is gets asked afterwards.
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

  const votes = new Map<string, Vote>();
  landmarks.forEach((landmark, at) => {
    const region = landmark.region === null ? null : folded(landmark.region);
    const name =
      landmark.region !== null && region !== null && (townsIn.get(region)?.size ?? 0) > 1
        ? landmark.region
        : (landmark.locality ?? landmark.region);
    if (name !== null) {
      vote(votes, name, at);
    }
  });

  return ranked(votes, limit);
}

/**
 * The towns the landmarks near a city are in, the best known first, and never
 * the city itself.
 *
 * Counted as a country's cities are, to the town a landmark's address names
 * or else its province, except that no province is ever taken for a city:
 * near a city nearly every landmark is in the one province, and that would
 * make every town around it the same place. Most of what is best known near
 * a city is in the city, so the city is left out by name.
 */
export function townsFromLandmarks(
  landmarks: readonly LandmarkPlace[],
  city: string,
  limit: number,
): readonly string[] {
  const home = folded(city);
  const votes = new Map<string, Vote>();
  landmarks.forEach((landmark, at) => {
    const name = landmark.locality ?? landmark.region;
    if (name !== null && folded(name) !== home) {
      vote(votes, name, at);
    }
  });
  return ranked(votes, limit);
}

/** The country an address ends in, "Vietnam" from "Hanoi, Ha Noi, Vietnam". */
export function countryOf(address: string | null): string | null {
  const last = address?.split(",").at(-1)?.trim() ?? "";
  return last === "" ? null : last;
}

/**
 * Each name as a city the provider can name, the first it answers with, so
 * every row is a city with the provider's own identifier and the line under
 * its name, and two spellings of one city come back as one. Near the city
 * when there is one, so a town's name that is also a town's across the
 * country is the one close by.
 */
async function asCities(
  names: readonly string[],
  country: string,
  near: LatLng | null,
  provider: PlacesProvider,
): Promise<readonly PlaceSuggestion[]> {
  const named = await Promise.all(
    names.map((name) =>
      provider.search({ query: `${name}, ${country}`, near, limit: 1, citiesOnly: true, session: null }),
    ),
  );
  const found: PlaceSuggestion[] = [];
  for (const [first] of named) {
    if (first !== undefined && !found.some((one) => one.providerPlaceId === first.providerPlaceId)) {
      found.push(first);
    }
  }
  return found;
}

/** A city worth going to, and how far and which way it is from the day's city. */
export interface CityToVisit extends PlaceSuggestion {
  readonly distanceMeters: number;
  readonly direction: CompassPoint;
}

/** A city suggested, and where it is. */
export interface PlacedCity {
  readonly city: PlaceSuggestion;
  readonly position: LatLng;
}

/**
 * The cities worth going to from a point, nearest first, each with how far it
 * is and which way, and none so close that it is the city the point is in.
 */
export function nearestFirst(
  from: LatLng,
  placed: readonly PlacedCity[],
  limit: number,
): readonly CityToVisit[] {
  const cities: CityToVisit[] = [];
  for (const { city, position } of placed) {
    const distanceMeters = metersBetween(from, position);
    if (distanceMeters >= NEAREST_METERS) {
      cities.push({ ...city, distanceMeters, direction: compassPoint(from, position) });
    }
  }
  return cities.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
}

/**
 * The cities worth going to from a city, for the picker nobody has typed in
 * yet: the towns near it and the best known cities in its country, in one
 * list, nearest first.
 *
 * Asked in steps, all kept in our own tables: the city, for its country and
 * where it is; the landmarks near it and the landmarks in its country, for
 * the towns and cities they are in, each asked for as a city so every row
 * has the provider's own identifier; and each of those cities, for where it
 * is. A city that came up in both lists is looked up once. Null when the
 * city cannot be found or has no country to go on.
 */
export async function citiesToVisit(
  cityPlaceId: string,
  limit: number,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<readonly CityToVisit[] | null> {
  const city = await placeDetailsFor(cityPlaceId, provider, null, now);
  const country = countryOf(city?.address ?? null);
  if (city === null || country === null) {
    return null;
  }

  const [nearby, popular] = await Promise.all([
    suggestionsFor(
      { query: NEARBY_KEY, biasKey: cityPlaceId, size: NEARBY_KEPT },
      async () => {
        // Asked about where people go to stay, which is out of town by
        // nature. Asked for towns to visit near the city, places outside it,
        // or day trips from it, the provider answers with the city's own
        // sights, its suburbs, and the tour desks in its middle.
        const landmarks = await provider.landmarks({
          query: `weekend getaways from ${city.name}, ${country}`,
          limit: LANDMARKS_ASKED,
        });
        return asCities(townsFromLandmarks(landmarks, city.name, NEARBY_KEPT), country, city.position, provider);
      },
      now,
    ),
    suggestionsFor(
      { query: POPULAR_KEY, biasKey: country, size: POPULAR_KEPT },
      async () => {
        const landmarks = await provider.landmarks({
          query: `best cities to visit in ${country}`,
          limit: LANDMARKS_ASKED,
        });
        return asCities(citiesFromLandmarks(landmarks, POPULAR_KEPT), country, null, provider);
      },
      now,
    ),
  ]);

  const candidates: PlaceSuggestion[] = [];
  for (const one of [...nearby, ...popular]) {
    if (
      one.providerPlaceId !== cityPlaceId &&
      !candidates.some((kept) => kept.providerPlaceId === one.providerPlaceId)
    ) {
      candidates.push(one);
    }
  }

  const placed = await Promise.all(
    candidates.map(async (one): Promise<PlacedCity | null> => {
      const details = await placeDetailsFor(one.providerPlaceId, provider, null, now);
      return details === null ? null : { city: one, position: details.position };
    }),
  );
  return nearestFirst(
    city.position,
    placed.filter((one) => one !== null),
    limit,
  );
}
