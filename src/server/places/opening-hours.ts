import { z } from "zod";
import type { WeeklyOpeningHours } from "@/core/model/place";
import { MINUTES_PER_DAY } from "@/core/time/minutes";

/** A window may run past midnight, so closesAt is allowed beyond 1440. */
const openingWindowSchema = z.object({
  opensAt: z.number().int().min(0).max(MINUTES_PER_DAY),
  closesAt: z
    .number()
    .int()
    .min(0)
    .max(2 * MINUTES_PER_DAY),
});

const dayWindowsSchema = z.array(openingWindowSchema);

/** Sunday first, matching Weekday in the core model. */
const weeklyOpeningHoursSchema = z.object({
  0: dayWindowsSchema,
  1: dayWindowsSchema,
  2: dayWindowsSchema,
  3: dayWindowsSchema,
  4: dayWindowsSchema,
  5: dayWindowsSchema,
  6: dayWindowsSchema,
});

/**
 * Opening hours as stored in the Place table's Json column.
 *
 * Anything that does not parse becomes null, which the domain reads as "we do
 * not know the hours". That is different from being closed, and it is the only
 * honest answer for a value we cannot read: the engine then makes no claim
 * about opening times rather than inventing one.
 */
export function parseOpeningHours(value: unknown): WeeklyOpeningHours | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = weeklyOpeningHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The other direction, on the way into the Json column. Copied into plain
 * objects because Prisma's Json input will not take our readonly domain type.
 */
export function openingHoursToJson(
  hours: WeeklyOpeningHours | null,
): Record<string, { opensAt: number; closesAt: number }[]> | undefined {
  if (hours === null) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(hours).map(([day, windows]) => [
      day,
      windows.map((window) => ({ opensAt: window.opensAt, closesAt: window.closesAt })),
    ]),
  );
}
