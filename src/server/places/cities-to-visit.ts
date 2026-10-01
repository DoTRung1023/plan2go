import type { Box } from "@/core/model/distance";
import { boxAround, metersBetween } from "@/core/model/distance";
import type { LatLng } from "@/core/model/place";
import { foldedName, plainName } from "@/core/model/place-name";
import type { LandmarkPlace, PlaceSuggestion, PlacesProvider } from "@/core/ports/places-provider";
import { consumeRateLimit } from "../rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "../rate-limit/window";
import { placeDetailsFor } from "./place-details";
import { suggestionsFor } from "./suggestion-cache";

/** What working out the cities worth going to is counted under, whoever asks for it. */
export const CITIES_TO_VISIT_ROUTE = "places-cities";

/**
 * As tight as the typed search is loose: this is worked out once each time a
 * day is put in a city and asked once each time the city picker opens, so a
 * person reaches it a handful of times in a minute at most.
 */
export const CITIES_TO_VISIT_POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 10 };

/** Landmarks asked for, which is as many as one text search answers with. */
const LANDMARKS_ASKED = 20;

/**
 * Neither question has words of its own beyond the place it is about, so each
 * is filed under a fixed name and told apart by the place, which goes where a
 * typed search keeps its bias point: the country for its best known cities,
 * and the city for the towns around it. Every trip to a country asks the same
 * first question, every trip to a city the same second one, and the second
 * time either is asked it costs nothing.
 */
const POPULAR_KEY = "cities:famous";
const NEARBY_KEY = "cities:around";

/**
 * The best known cities in the country, kept and looked up. One more than the
 * towns around a city, since one of them is usually the city the day is in,
 * which the list leaves out.
 */
const POPULAR_KEPT = 12;

/** The towns around the city, kept and looked up. */
const NEARBY_KEPT = 10;

/**
 * How far out from the city the towns around it are looked for, in metres:
 * a few hours on the road, which is where a day of the trip might move to.
 */
const AROUND_METERS = 250_000;

/**
 * Closer than this is the city itself: its suburbs, and the district a
 * landmark in its middle is filed under. Nobody moves a day of the trip to go
 * somewhere a bus ride from where they are staying. The search for the towns
 * around the city leaves it out as well: asked about as a whole, the country
 * around a city answers with the city's own sights and the tour desks in its
 * middle.
 */
const NEAREST_METERS = 15_000;

/** Landmarks this close to the first of a group are in the one place to go. */
const GROUP_METERS = 25_000;

/**
 * How far a town can be from the landmarks it is named for and still be
 * theirs. Further than that, a name found is some other place called the same:
 * there is a Quảng Bình in Thanh Hóa, 250 km from the caves people mean.
 */
const MATCH_METERS = 30_000;

/** Groups of landmarks looked up as towns, for each list, past which the rest are left. */
const GROUPS_TRIED = 14;

/**
 * Names tried for one group, past which it is given up on. Each is a search,
 * and they are all asked at once, so this is what a group costs every time.
 */
const NAMES_TRIED = 4;

/** A town's answers read to find the one named, near the landmarks it is looked up for. */
const MATCHES_READ = 5;

/**
 * The words in front of a ward named for the part of a town it is: Vietnam's
 * wards were redrawn as "Bắc Nha Trang" and "Nam Nha Trang", the north and
 * south of Nha Trang. With their accents, since without them the east, Đông,
 * is the field, Đồng, and Đồng Nai is no ward of anywhere called Nai.
 */
const WARD_QUARTERS = new Set(["bắc", "nam", "đông", "tây"]);

/** The same words in a name written without any accents at all, "Bac Nha Trang", which says no more. */
const WARD_QUARTERS_PLAIN = new Set(["bac", "nam", "dong", "tay"]);

/**
 * The town a ward is named for, when it is named for one: "Đà Lạt" from
 * "Xuân Hương - Đà Lạt", and "Nha Trang" from "Bắc Nha Trang". Null for a
 * name that is not written as a ward's.
 */
export function townOf(name: string): string | null {
  const dash = name.lastIndexOf(" - ");
  if (dash !== -1) {
    const town = name.slice(dash + 3).trim();
    return town === "" ? null : town;
  }
  const [first, ...rest] = name.normalize("NFC").trim().split(/\s+/);
  if (first === undefined || rest.length === 0) {
    return null;
  }
  const quarters = plainName(name) === name.toLowerCase() ? WARD_QUARTERS_PLAIN : WARD_QUARTERS;
  return quarters.has(first.toLowerCase()) ? rest.join(" ") : null;
}

interface Vote {
  readonly name: string;
  readonly count: number;
  readonly first: number;
}

/** One more landmark for a name, which is the first it came up at if it is new. */
function vote(votes: Map<string, Vote>, name: string, at: number): void {
  const key = foldedName(name);
  const counted = votes.get(key);
  votes.set(key, counted === undefined ? { name, count: 1, first: at } : { ...counted, count: counted.count + 1 });
}

/**
 * Ranked by how many landmarks name each, and after that by which came up
 * first, since the provider ranks the landmarks and that ranking is worth
 * keeping.
 */
function ranked(votes: ReadonlyMap<string, Vote>): readonly string[] {
  return [...votes.values()].sort((a, b) => b.count - a.count || a.first - b.first).map((counted) => counted.name);
}

/**
 * The landmarks in groups by where they are, each group one place to go: a
 * landmark joins the first group whose first landmark is close enough, and
 * otherwise starts a group of its own. The groups with the most landmarks
 * come first, and between groups with as many, the one the provider ranked
 * first.
 */
export function groupedByPlace(
  landmarks: readonly LandmarkPlace[],
): readonly (readonly LandmarkPlace[])[] {
  const groups: LandmarkPlace[][] = [];
  for (const landmark of landmarks) {
    const group = groups.find(
      ([first]) =>
        first !== undefined && metersBetween(first.position, landmark.position) <= GROUP_METERS,
    );
    if (group === undefined) {
      groups.push([landmark]);
    } else {
      group.push(landmark);
    }
  }
  // A stable sort, so groups with as many landmarks keep the order they started in.
  return groups.sort((a, b) => b.length - a.length);
}

/** A name a group of landmarks might be called, and whether it is the name of their province. */
export interface GroupName {
  readonly name: string;
  readonly province: boolean;
}

/**
 * What a group of landmarks might be called, the likeliest first: the
 * province most of them are in, then the towns their addresses name, the most
 * named first, then their districts, then their other provinces. A ward named
 * for its town is tried as the town first.
 *
 * The province first, because a province can be a city, as Hà Nội, Cần Thơ
 * and Đà Nẵng are, and then the landmarks in it name its wards and its
 * districts, and a traveller means the city. Where a province is not a city,
 * no city of its name is close enough to be taken, and the towns are tried
 * next. Only the one province, until the end: a landmark whose address still
 * names a province that was merged into another names a province that is
 * gone, and some place near it can share the name, as a Bình Thuận does a few
 * kilometres out of Phan Thiết, whose landmarks are filed under Bình Thuận
 * and Lâm Đồng both.
 */
export function namesFor(group: readonly LandmarkPlace[]): readonly GroupName[] {
  const towns = new Map<string, Vote>();
  const districts = new Map<string, Vote>();
  const regions = new Map<string, Vote>();
  group.forEach((landmark, at) => {
    if (landmark.locality !== null) {
      vote(towns, landmark.locality, at);
    }
    if (landmark.district !== null) {
      vote(districts, landmark.district, at);
    }
    if (landmark.region !== null) {
      vote(regions, landmark.region, at);
    }
  });

  const province = (name: string): GroupName => ({ name, province: true });
  const area = (name: string): GroupName => ({ name, province: false });
  const [region, ...otherRegions] = ranked(regions).map(province);
  const inOrder = [
    ...(region === undefined ? [] : [region]),
    ...ranked(towns).flatMap((name) => {
      const town = townOf(name);
      return town === null ? [area(name)] : [area(town), area(name)];
    }),
    ...ranked(districts).map(area),
    ...otherRegions,
  ];

  const names: GroupName[] = [];
  for (const one of inOrder) {
    if (!names.some((kept) => foldedName(kept.name) === foldedName(one.name))) {
      names.push(one);
    }
  }
  return names;
}

/**
 * The town a group of landmarks is in, as the provider names it: the first of
 * the group's names that the provider has an area for, a town, a district or
 * a ward, called that, near where the landmarks are. Null when none of them
 * is.
 *
 * A province's name is taken only as close as the city itself reaches, so
 * that it is the city the landmarks are in and not the one down the road:
 * Sa Pa's landmarks are in Lào Cai province, and Lào Cai, the town, is 20 km
 * from them.
 *
 * Every name is asked about at once rather than one after another, since a
 * list is built while somebody waits for it, and asking in turn put a round
 * trip to the provider in front of each name the last one missed. The answers
 * are still read in the order the names were ranked, so the town is the same
 * one asking in turn would have found.
 */
export async function townFor(
  group: readonly LandmarkPlace[],
  provider: PlacesProvider,
): Promise<PlaceSuggestion | null> {
  const [first] = group;
  if (first === undefined) {
    return null;
  }
  const names = namesFor(group).slice(0, NAMES_TRIED);
  const answers = await Promise.all(
    names.map(({ name }) =>
      provider.search({
        query: name,
        near: first.position,
        limit: MATCHES_READ,
        only: "areas",
        session: null,
      }),
    ),
  );
  for (const [at, { name, province }] of names.entries()) {
    const found = answers[at] ?? [];
    const within = province ? NEAREST_METERS : MATCH_METERS;
    const match = found.find(
      (one) =>
        foldedName(one.name) === foldedName(name) &&
        one.distanceMeters !== null &&
        one.distanceMeters <= within,
    );
    if (match !== undefined) {
      return match;
    }
  }
  return null;
}

/**
 * The towns a country's landmarks are in, the best known first, each with the
 * provider's own identifier, and each once however many groups of landmarks
 * it has. Only the landmarks in the country count: the country around a city
 * near a border is partly the next one.
 */
async function townsAt(
  landmarks: readonly LandmarkPlace[],
  country: string,
  limit: number,
  provider: PlacesProvider,
): Promise<readonly PlaceSuggestion[]> {
  const inCountry = landmarks.filter((landmark) => foldedName(landmark.country ?? "") === foldedName(country));
  const towns = await Promise.all(
    groupedByPlace(inCountry)
      .slice(0, GROUPS_TRIED)
      .map((group) => townFor(group, provider)),
  );
  const found: PlaceSuggestion[] = [];
  for (const town of towns) {
    if (town !== null && !found.some((one) => one.providerPlaceId === town.providerPlaceId)) {
      found.push(town);
    }
  }
  return found.slice(0, limit);
}

/**
 * The country around a city as four boxes, north, south, east and west of
 * it, with the city itself left out of all of them.
 */
export function boxesAround(centre: LatLng): readonly Box[] {
  const outer = boxAround(centre, AROUND_METERS);
  const city = boxAround(centre, NEAREST_METERS);
  return [
    { low: { lat: city.high.lat, lng: outer.low.lng }, high: outer.high },
    { low: outer.low, high: { lat: city.low.lat, lng: outer.high.lng } },
    { low: { lat: city.low.lat, lng: city.high.lng }, high: { lat: city.high.lat, lng: outer.high.lng } },
    { low: { lat: city.low.lat, lng: outer.low.lng }, high: { lat: city.high.lat, lng: city.low.lng } },
  ];
}

/**
 * The lists of landmarks as one, taking the best of each in turn, so that
 * between groups with as many landmarks, one side of the city does not come
 * first just because it was asked about first.
 */
export function inTurn<T>(lists: readonly (readonly T[])[]): readonly T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  const all: T[] = [];
  for (let at = 0; at < longest; at += 1) {
    for (const list of lists) {
      const one = list[at];
      if (one !== undefined) {
        all.push(one);
      }
    }
  }
  return all;
}

/** The country an address ends in, "Vietnam" from "Hanoi, Ha Noi, Vietnam". */
export function countryOf(address: string | null): string | null {
  const last = address?.split(",").at(-1)?.trim() ?? "";
  return last === "" ? null : last;
}

/** A city suggested, and where it is. */
export interface PlacedCity {
  readonly city: PlaceSuggestion;
  readonly position: LatLng;
}

/**
 * The cities worth going to from a point, nearest first, each with how far it
 * is from the point, and none so close that it is the city the point is in.
 */
export function nearestFirst(
  from: LatLng,
  placed: readonly PlacedCity[],
  limit: number,
): readonly PlaceSuggestion[] {
  return placed
    .map(({ city, position }) => ({ ...city, distanceMeters: metersBetween(from, position) }))
    .filter((city) => city.distanceMeters >= NEAREST_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/**
 * The cities worth going to from a city, for the picker nobody has typed in
 * yet: the towns around it and the best known cities in its country, in one
 * list, nearest first.
 *
 * Found by where the landmarks are rather than by what their addresses call
 * the town, since an address often names only the ward: the tourist
 * attractions around the city and the landmarks the country is best known
 * for, in groups by place, each group the town the provider names near it.
 *
 * Asked in steps, all kept in our own tables: the city, for its country and
 * where it is; the landmarks around it and in its country; each group's town;
 * and each town, for where it is. A town that came up in both lists is
 * looked up once. Null when the city cannot be found or has no country to go
 * on.
 */
export async function citiesToVisit(
  cityPlaceId: string,
  limit: number,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<readonly PlaceSuggestion[] | null> {
  const city = await placeDetailsFor(cityPlaceId, provider, null, now);
  const country = countryOf(city?.address ?? null);
  if (city === null || country === null) {
    return null;
  }

  const [nearby, popular] = await Promise.all([
    suggestionsFor(
      { query: NEARBY_KEY, biasKey: cityPlaceId, size: NEARBY_KEPT },
      async () => {
        const sides = await Promise.all(
          boxesAround(city.position).map((within) =>
            provider.landmarks({ query: "tourist attractions", within, limit: LANDMARKS_ASKED }),
          ),
        );
        return townsAt(inTurn(sides), country, NEARBY_KEPT, provider);
      },
      now,
    ),
    suggestionsFor(
      { query: POPULAR_KEY, biasKey: country, size: POPULAR_KEPT },
      async () => {
        const landmarks = await provider.landmarks({
          query: `best cities to visit in ${country}`,
          within: null,
          limit: LANDMARKS_ASKED,
        });
        return townsAt(landmarks, country, POPULAR_KEPT, provider);
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

/**
 * The cities worth going to from a city, worked out and kept as soon as a day
 * is in it, so the picker's first opening there is answered from our own
 * tables instead of waiting on every step above. A city worked out lately
 * costs only the reads.
 *
 * Counted against the picker's own budget, so putting a day in one city after
 * another is no way around it. Past the budget nothing is worked out, and the
 * picker asks for itself when it opens.
 */
export async function prepareCitiesToVisit(
  headers: Headers,
  cityPlaceId: string,
  provider: PlacesProvider,
): Promise<void> {
  const limit = await consumeRateLimit(CITIES_TO_VISIT_ROUTE, headers, CITIES_TO_VISIT_POLICY);
  if (limit.allowed) {
    await citiesToVisit(cityPlaceId, NEARBY_KEPT + POPULAR_KEPT, provider);
  }
}
