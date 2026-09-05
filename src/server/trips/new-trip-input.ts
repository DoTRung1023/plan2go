import { z } from "zod";
import { addDays, daysBetween } from "@/core/time/zoned";

/** Long enough for a real holiday, short enough that nobody scripts it. */
export const MAX_TRIP_DAYS = 30;

const supportedTimeZones = new Set(Intl.supportedValuesOf("timeZone"));

function calendarDate(missing: string): z.ZodType<string> {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, missing)
    .refine((value) => addDays(value, 0) === value, "That date does not exist. Check it.");
}

/** Both ends counted, so a trip that starts and ends on one day is one day long. */
function daysAcross(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

/**
 * What a person may send when they open a trip.
 *
 * The two ends are dates rather than a length, the same way they are once the
 * trip is open: a person planning a holiday knows when they land and when they
 * fly home, and counting the nights in between is the thing they came here to
 * stop doing. The length is worked out here, because that is what storage lays
 * the days out from.
 *
 * Messages say what happened and then what to do, because they are read by
 * someone who has just been stopped.
 */
export const newTripInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "The city is missing. Enter where you are going.")
      .max(80, "That city name is too long. Use 80 characters or fewer."),
    timeZone: z
      .string()
      .refine(
        (value) => supportedTimeZones.has(value),
        "That is not a time zone we know. Choose one from the list.",
      ),
    startDate: calendarDate("The first day is missing. Enter a date."),
    endDate: calendarDate("The last day is missing. Enter a date."),
  })
  .refine((value) => daysAcross(value.startDate, value.endDate) >= 1, {
    message: "The last day is before the first day. Choose a later last day.",
    path: ["endDate"],
  })
  .refine((value) => daysAcross(value.startDate, value.endDate) <= MAX_TRIP_DAYS, {
    message: `A trip runs to ${String(MAX_TRIP_DAYS)} days at most. Choose an earlier last day.`,
    path: ["endDate"],
  })
  .transform((value) => ({
    title: value.title,
    timeZone: value.timeZone,
    startDate: value.startDate,
    dayCount: daysAcross(value.startDate, value.endDate),
  }));

export type NewTripInput = z.infer<typeof newTripInputSchema>;
