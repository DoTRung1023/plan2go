"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import type { StopChanged } from "@/server/repositories/trip-repository";
import {
  MAX_NOTE_LENGTH,
  MAX_STAY_MINUTES,
  moveStop,
  removeStop,
  setStopNote,
  setStopStay,
} from "@/server/trips/edit-stop";
import { travelProvider } from "./travel";

export interface StopEditState {
  readonly error: string | null;
}

const stop = {
  slug: z.string().min(1).max(80),
  stopId: z.string().min(1).max(40),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
};

/**
 * The key arrives raw in the input and goes no further than this: everything
 * under it works from the hash, which is what storage holds.
 */
function scoped<T extends { readonly editKey: string }>(
  parsed: T,
): Omit<T, "editKey"> & { readonly editKeyHash: string } {
  const { editKey, ...rest } = parsed;
  return { ...rest, editKeyHash: hashEditKey(editKey) };
}

const staySchema = z.object({
  ...stop,
  stayMinutes: z.number().int().min(0).max(MAX_STAY_MINUTES),
});

const noteSchema = z.object({
  ...stop,
  note: z.string().max(MAX_NOTE_LENGTH).nullable(),
});

const removeSchema = z.object(stop);

const moveSchema = z.object({ ...stop, toPosition: z.number().int().min(0).max(200) });

const UNREADABLE = "That change could not be read. Try it again.";

const NOT_YOURS =
  "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.";

/**
 * The key out of the edit link is hashed here and checked inside the query that finds the stop, so nothing is
 * written without one and no separate trip to the database is spent asking. A
 * stop that is not there and a trip that is not yours are deliberately given
 * the same sentence: telling them apart turns this into a way to test slugs.
 */
async function finish(slug: string, change: Promise<StopChanged>): Promise<StopEditState> {
  const result = await change;
  if (result.status === "refused") {
    return { error: NOT_YOURS };
  }
  revalidatePath(`/t/${slug}`, "layout");
  return { error: null };
}

export async function setStopStayAction(input: unknown): Promise<StopEditState> {
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) {
    return { error: UNREADABLE };
  }
  return finish(
    parsed.data.slug,
    setStopStay(
      scoped(parsed.data),
      prismaTripRepository,
    ),
  );
}

export async function setStopNoteAction(input: unknown): Promise<StopEditState> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: UNREADABLE };
  }
  return finish(
    parsed.data.slug,
    setStopNote(
      scoped(parsed.data),
      prismaTripRepository,
    ),
  );
}

export async function removeStopAction(input: unknown): Promise<StopEditState> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: UNREADABLE };
  }
  return finish(
    parsed.data.slug,
    removeStop(
      scoped(parsed.data),
      prismaTripRepository,
      travelProvider(),
    ),
  );
}

export async function moveStopAction(input: unknown): Promise<StopEditState> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: UNREADABLE };
  }
  return finish(
    parsed.data.slug,
    moveStop(
      scoped(parsed.data),
      prismaTripRepository,
      travelProvider(),
    ),
  );
}
