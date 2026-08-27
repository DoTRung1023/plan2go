/**
 * Stand in data so the shell can be built and looked at before the repository
 * is wired to a query. Three days in Adelaide, two of which are wrong in a way
 * a real person would only find out on the footpath: the market is shut on the
 * Sunday, and the gallery closes five minutes before the Monday arrival. It
 * goes away with the sprint that loads a real trip.
 */
import type { DayPlan } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { OpeningWindow, Place, WeeklyOpeningHours } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { Trip } from "@/core/model/trip";
import { clockToMinutes } from "@/core/time/minutes";

function opening(
  openHour: number,
  openMinute: number,
  closeHour: number,
  closeMinute: number,
): readonly OpeningWindow[] {
  return [
    {
      opensAt: clockToMinutes(openHour, openMinute),
      closesAt: clockToMinutes(closeHour, closeMinute),
    },
  ];
}

const SHUT: readonly OpeningWindow[] = [];

function everyDay(windows: readonly OpeningWindow[]): WeeklyOpeningHours {
  return { 0: windows, 1: windows, 2: windows, 3: windows, 4: windows, 5: windows, 6: windows };
}

const APARTMENT: Place = {
  id: "place-apartment",
  providerPlaceId: null,
  name: "Apartment on Gilbert Street",
  address: "Gilbert Street, Adelaide",
  position: { lat: -34.931, lng: 138.596 },
  openingHours: null,
};

const CENTRAL_MARKET: Place = {
  id: "place-central-market",
  providerPlaceId: null,
  name: "Adelaide Central Market",
  address: "44 Gouger Street, Adelaide",
  position: { lat: -34.9294, lng: 138.5974 },
  openingHours: {
    0: SHUT,
    1: SHUT,
    2: opening(7, 0, 17, 0),
    3: opening(9, 0, 17, 0),
    4: opening(9, 0, 17, 30),
    5: opening(7, 0, 21, 0),
    6: opening(7, 0, 15, 0),
  },
};

const ART_GALLERY: Place = {
  id: "place-art-gallery",
  providerPlaceId: null,
  name: "Art Gallery of South Australia",
  address: "North Terrace, Adelaide",
  position: { lat: -34.921, lng: 138.6047 },
  openingHours: everyDay(opening(10, 0, 17, 0)),
};

const BOTANIC_GARDEN: Place = {
  id: "place-botanic-garden",
  providerPlaceId: null,
  name: "Adelaide Botanic Garden",
  address: "North Terrace, Adelaide",
  position: { lat: -34.9187, lng: 138.6096 },
  openingHours: everyDay(opening(9, 0, 18, 0)),
};

const ZOO: Place = {
  id: "place-zoo",
  providerPlaceId: null,
  name: "Adelaide Zoo",
  address: "Frome Road, Adelaide",
  position: { lat: -34.9145, lng: 138.6058 },
  openingHours: everyDay(opening(9, 30, 17, 0)),
};

const GLENELG_BEACH: Place = {
  id: "place-glenelg-beach",
  providerPlaceId: null,
  name: "Glenelg Beach",
  address: "Moseley Square, Glenelg",
  position: { lat: -34.9803, lng: 138.5142 },
  openingHours: null,
};

function stop(
  id: string,
  place: Place,
  stayMinutes: number,
  travelMode: TravelMode,
  note: string | null = null,
): Stop {
  return { id, place, stayMinutes, travelMode, note };
}

function day(
  id: string,
  date: string,
  leaveAtMinutes: number,
  stops: readonly Stop[],
  returnTravelMode: TravelMode,
): DayPlan {
  return {
    id,
    date,
    timeZone: "Australia/Adelaide",
    label: null,
    homeBase: APARTMENT,
    leaveAtMinutes,
    stops,
    returnTravelMode,
  };
}

export const PLACEHOLDER_TRIP: Trip = {
  id: "trip-placeholder",
  slug: "placeholder",
  title: "Adelaide",
  timeZone: "Australia/Adelaide",
  userId: null,
  days: [
    day(
      "day-1",
      "2026-08-22",
      clockToMinutes(9, 0),
      [
        stop("stop-1-market", CENTRAL_MARKET, 60, "walk", "Breakfast before the crowds."),
        stop("stop-1-gallery", ART_GALLERY, 75, "walk"),
        stop("stop-1-garden", BOTANIC_GARDEN, 60, "walk"),
      ],
      "walk",
    ),
    day(
      "day-2",
      "2026-08-23",
      clockToMinutes(9, 30),
      [
        stop("stop-2-beach", GLENELG_BEACH, 120, "drive"),
        stop("stop-2-market", CENTRAL_MARKET, 45, "drive"),
      ],
      "drive",
    ),
    day(
      "day-3",
      "2026-08-24",
      clockToMinutes(13, 30),
      [
        stop("stop-3-zoo", ZOO, 120, "walk"),
        stop("stop-3-garden", BOTANIC_GARDEN, 45, "walk"),
        stop("stop-3-gallery", ART_GALLERY, 60, "walk"),
      ],
      "walk",
    ),
  ],
};
