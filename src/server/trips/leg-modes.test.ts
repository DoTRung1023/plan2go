import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LegResolution, TravelRequest } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { legRequestsFor } from "@/core/time/leg-requests";
import type { LegModeUpdate, TripRepository } from "../repositories/trip-repository";
import { fastestTravelMode, legsWithNewEnds, refreshLegModes } from "./leg-modes";

function place(id: string): Place {
  return {
    id,
    providerPlaceId: null,
    name: id,
    address: null,
    position: { lat: -34.9, lng: 138.6 },
    openingHours: null,
  };
}

function stop(id: string): Stop {
  return { id, place: place(id), stayMinutes: 60, travelMode: "walk", note: null };
}

const HOTEL: DayEndpoint = { place: place("hotel"), label: "Hotel" };

function day(stops: readonly Stop[], over: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "d1",
    date: "2026-03-01",
    timeZone: "Australia/Adelaide",
    label: null,
    start: HOTEL,
    end: HOTEL,
    startAtMinutes: 540,
    stops,
    endTravelMode: "walk",
    city: null,
    ...over,
  };
}

const A = stop("a");
const B = stop("b");
const C = stop("c");

describe("legsWithNewEnds", () => {
  it("relays only the legs a move actually changed", () => {
    const relaid = legsWithNewEnds(day([A, B, C]), day([C, A, B]));

    // C now leaves the hotel, A now leaves C, and the way home now leaves B.
    // B still leaves A, so whatever was chosen for it stands.
    expect(relaid.map((leg) => leg.target)).toEqual(["c", "a", null]);
    expect(relaid.find((leg) => leg.target === "c")?.from.id).toBe("hotel");
    expect(relaid.find((leg) => leg.target === null)?.from.id).toBe("b");
  });

  it("relays the leg that closes over a removed stop", () => {
    const relaid = legsWithNewEnds(day([A, B, C]), day([A, C]));

    expect(relaid.map((leg) => leg.target)).toEqual(["c"]);
    expect(relaid[0]?.from.id).toBe("a");
    expect(relaid[0]?.to.id).toBe("c");
  });

  it("leaves a day alone when nothing moved", () => {
    expect(legsWithNewEnds(day([A, B, C]), day([A, B, C]))).toEqual([]);
  });

  it("says nothing about a first stop that has nothing travelling to it", () => {
    const before = day([A, B], { start: null, end: null });
    const after = day([B, A], { start: null, end: null });

    // Only the second stop has a leg at all, and it arrives from the other one.
    expect(legsWithNewEnds(before, after).map((leg) => leg.target)).toEqual(["a"]);
  });

  it("relays the way home when the last stop changes", () => {
    const relaid = legsWithNewEnds(day([A, B]), day([B, A]));
    expect(relaid.map((leg) => leg.target)).toEqual(["b", "a", null]);
  });
});

/** Every mode answered, the drive fastest, with what was asked kept. */
function recording(): { readonly asked: TravelRequest[]; readonly estimate: (request: TravelRequest) => Promise<LegResolution> } {
  const asked: TravelRequest[] = [];
  const minutes = { walk: 40, drive: 12, transit: 25 } as const;
  return {
    asked,
    estimate: (request) => {
      asked.push(request);
      return Promise.resolve({
        status: "resolved",
        estimate: {
          mode: request.mode,
          durationMinutes: minutes[request.mode],
          distanceMeters: 3000,
          source: "google-routes",
          path: null,
          rides: null,
        },
      });
    },
  };
}

describe("fastestTravelMode", () => {
  it("asks every mode at the moment given, and takes the fastest", async () => {
    const travel = recording();
    const mode = await fastestTravelMode(
      HOTEL.place.position,
      A.place.position,
      { name: "recording", estimate: travel.estimate },
      29_000_000,
    );

    expect(mode).toBe("drive");
    expect(travel.asked.map((request) => request.departAt)).toEqual([
      29_000_000,
      29_000_000,
      29_000_000,
    ]);
  });

  it("asks with no moment when given none", async () => {
    const travel = recording();
    await fastestTravelMode(HOTEL.place.position, A.place.position, {
      name: "recording",
      estimate: travel.estimate,
    });

    expect(travel.asked.every((request) => request.departAt === null)).toBe(true);
  });
});

describe("refreshLegModes", () => {
  const NOT_STUBBED = "This stub only answers setting a leg's mode.";

  /** Keeps the modes written, and answers nothing else. */
  function repositoryKeepingModes(): {
    readonly repository: TripRepository;
    readonly modes: LegModeUpdate[];
  } {
    const modes: LegModeUpdate[] = [];
    const unstubbed = (): Promise<never> => Promise.reject(new Error(NOT_STUBBED));
    return {
      modes,
      repository: {
        findBySlug: unstubbed,
        findEditKeyHash: unstubbed,
        findPlaceByProviderId: unstubbed,
        setLegMode: (update) => {
          modes.push(update);
          return Promise.resolve({ status: "set" });
        },
        create: unstubbed,
        updateSettings: unstubbed,
        delete: unstubbed,
        addStop: unstubbed,
        setDayEndpoint: unstubbed,
        setDayStart: unstubbed,
        setDayCity: unstubbed,
        updateStop: unstubbed,
        removeStop: unstubbed,
        moveStop: unstubbed,
      },
    };
  }

  it("asks each changed leg at the moment the day in its new order sets out on it", async () => {
    const { repository, modes } = repositoryKeepingModes();
    const travel = recording();
    const after = day([B, A]);
    const setsOut = legRequestsFor(after)[0]?.departAt ?? 0;

    await refreshLegModes(
      { slug: "s", editKeyHash: "h", before: day([A, B]), after },
      repository,
      () => Promise.resolve({ name: "recording", estimate: travel.estimate }),
    );

    // Every leg changed ends, and each is driven, twelve minutes, then an
    // hour at the stop, so the next sets out seventy two minutes later.
    expect(travel.asked.map((asked) => asked.departAt)).toEqual([
      ...Array<number>(3).fill(setsOut),
      ...Array<number>(3).fill(setsOut + 72),
      ...Array<number>(3).fill(setsOut + 144),
    ]);
    expect(modes.map(({ stopId, mode }) => [stopId, mode])).toEqual([
      ["b", "drive"],
      ["a", "drive"],
      [null, "drive"],
    ]);
  });

  it("answers a leg that kept its ends the way the day travels it, and asks nothing past the last change", async () => {
    const { repository, modes } = repositoryKeepingModes();
    const travel = recording();
    const after = day([A, C]);
    const setsOut = legRequestsFor(after)[0]?.departAt ?? 0;

    await refreshLegModes(
      { slug: "s", editKeyHash: "h", before: day([A, B, C]), after },
      repository,
      () => Promise.resolve({ name: "recording", estimate: travel.estimate }),
    );

    // Out to A on foot as before, forty minutes and an hour there, then every
    // way to C; the way home kept its ends and is not asked about at all.
    expect(travel.asked.map(({ mode, departAt }) => [mode, departAt])).toEqual([
      ["walk", setsOut],
      ["drive", setsOut + 100],
      ["transit", setsOut + 100],
      ["walk", setsOut + 100],
    ]);
    expect(modes.map(({ stopId, mode }) => [stopId, mode])).toEqual([["c", "drive"]]);
  });

  it("reads nothing and asks nothing when no leg changed its ends", async () => {
    const { repository, modes } = repositoryKeepingModes();
    let warmed = 0;

    await refreshLegModes(
      { slug: "s", editKeyHash: "h", before: day([A, B]), after: day([A, B]) },
      repository,
      () => {
        warmed += 1;
        return Promise.reject(new Error(NOT_STUBBED));
      },
    );

    expect(warmed).toBe(0);
    expect(modes).toEqual([]);
  });
});
