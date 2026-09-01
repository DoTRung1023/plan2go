import { z } from "zod";
import { addDays } from "@/core/time/zoned";
import { isSupportedTimeZone } from "./time-zones";

/** Long enough for a real holiday, short enough that nobody scripts it. */
export const MAX_TRIP_DAYS = 30;

/**
 * The four things a traveller may change about a trip once it is open. A trip
 * is not one city, so the name is whatever they call the whole thing rather
 * than a place, and the zone is the one they are travelling to.
 *
 * Messages say what happened and then what to do, because they are read by
 * someone who has just been stopped.
 */
export const tripSettingsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "The trip has no name. Enter what you want to call it.")
    .max(80, "That name is too long. Use 80 characters or fewer."),
  timeZone: z
    .string()
    .refine(
      isSupportedTimeZone,
      "That is not a time zone we know. Choose one from the list.",
    ),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "The first day is missing. Enter a date.")
    .refine((value) => addDays(value, 0) === value, "That date does not exist. Check it."),
  dayCount: z.coerce
    .number()
    .int("A trip is a whole number of days.")
    .min(1, "A trip is at least one day long.")
    .max(MAX_TRIP_DAYS, `A trip runs to ${String(MAX_TRIP_DAYS)} days at most.`),
});

export type TripSettings = z.infer<typeof tripSettingsSchema>;
