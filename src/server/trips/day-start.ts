import { clockToMinutes } from "@/core/time/minutes";

/** A new day begins at 9:00 am until the traveller says otherwise. */
export const DEFAULT_START_AT_MINUTES = clockToMinutes(9, 0);
