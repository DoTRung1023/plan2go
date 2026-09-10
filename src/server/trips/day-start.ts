import { clockToMinutes } from "@/core/time/minutes";

/** A new day begins at 09:00 until the traveller says otherwise. */
export const DEFAULT_START_AT_MINUTES = clockToMinutes(9, 0);
