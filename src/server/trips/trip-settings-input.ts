import { z } from "zod";
import { addDays, daysBetween } from "@/core/time/zoned";

/** Long enough for a real holiday, short enough that nobody scripts it. */
export const MAX_TRIP_DAYS = 30;

function calendarDate(missing: string): z.ZodType<string> {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, missing)
    .refine((value) => addDays(value, 0) === value, "That date does not exist. Check it.");
}

/**
 * What a traveller may change about a trip once it is open. A trip is not one
 * city, so the name is whatever they call the whole thing rather than a place.
 *
 * The time zone is not here. It is settled when the trip is opened and is not
 * something the traveller is asked about.
 *
 * The two ends of the trip are dates, not a length: a person planning a holiday
 * knows when they land and when they fly home, and counting the nights in
 * between is the thing they came here to stop doing.
 *
 * Messages say what happened and then what to do, because they are read by
 * someone who has just been stopped.
 */
export const tripSettingsSchema = z
  .object({
    slug: z.string().min(1).max(80),
    title: z
      .string()
      .trim()
      .min(1, "The trip has no name. Enter what you want to call it.")
      .max(80, "That name is too long. Use 80 characters or fewer."),
    startDate: calendarDate("The first day is missing. Enter a date."),
    endDate: calendarDate("The last day is missing. Enter a date."),
  })
  .refine((value) => daysBetween(value.startDate, value.endDate) >= 0, {
    message: "The last day is before the first day. Choose a later last day.",
    path: ["endDate"],
  })
  .refine((value) => daysBetween(value.startDate, value.endDate) < MAX_TRIP_DAYS, {
    message: `A trip runs to ${String(MAX_TRIP_DAYS)} days at most. Choose an earlier last day.`,
    path: ["endDate"],
  });

export type TripSettings = z.infer<typeof tripSettingsSchema>;
