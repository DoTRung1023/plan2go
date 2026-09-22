import { z } from "zod";
import { addDays } from "@/core/time/zoned";

/**
 * A date as a form sends it, YYYY-MM-DD, and one that exists: the thirty
 * first of a month with thirty days reads as a date and is not one, which
 * adding nothing to it shows up, since the day it lands on is a different one.
 */
export function calendarDate(missing: string): z.ZodType<string> {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, missing)
    .refine((value) => addDays(value, 0) === value, "That date does not exist. Check it.");
}
