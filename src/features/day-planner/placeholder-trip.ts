import type { DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { Trip } from "@/core/model/trip";

/**
 * Stand in data so the shell can be built and looked at before the repository
 * is wired to a query. It goes away with the sprint that loads a real trip.
 */
const APARTMENT: Place = {
  id: "place-apartment",
  providerPlaceId: null,
  name: "Apartment",
  address: null,
  position: { lat: -34.9285, lng: 138.6007 },
  openingHours: null,
};

function emptyDay(id: string, date: string): DayPlan {
  return {
    id,
    date,
    timeZone: "Australia/Adelaide",
    label: null,
    homeBase: APARTMENT,
    leaveAtMinutes: 9 * 60,
    stops: [],
    returnTravelMode: "walk",
  };
}

export const PLACEHOLDER_TRIP: Trip = {
  id: "trip-placeholder",
  slug: "placeholder",
  title: "Adelaide",
  timeZone: "Australia/Adelaide",
  userId: null,
  days: [
    emptyDay("day-1", "2026-08-22"),
    emptyDay("day-2", "2026-08-23"),
    emptyDay("day-3", "2026-08-24"),
  ],
};
