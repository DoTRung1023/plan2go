"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { tripSettingsSchema } from "@/server/trips/trip-settings-input";
import { updateTripSettings } from "@/server/trips/update-trip-settings";

const editKeySchema = z.string().regex(EDIT_KEY_PATTERN);

export interface TripSettingsState {
  readonly saved: boolean;
  readonly error: string | null;
}

/**
 * The key out of the edit link rides with the form and is checked inside the
 * query that finds the trip, so nothing is written without one. Someone reading
 * the plain link is not offered this form at all, and is told the same thing
 * either way if they send it anyway.
 */
export async function updateTripAction(
  _previous: TripSettingsState,
  formData: FormData,
): Promise<TripSettingsState> {
  const key = editKeySchema.safeParse(formData.get("editKey"));
  if (!key.success) {
    return { saved: false, error: "This trip could not be read. Reload the page." };
  }

  const parsed = tripSettingsSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      saved: false,
      error: first === undefined ? "Check the details and save them again." : first.message,
    };
  }

  const result = await updateTripSettings(
    parsed.data,
    hashEditKey(key.data),
    prismaTripRepository,
  );

  if (result.status === "refused") {
    return {
      saved: false,
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  return { saved: true, error: null };
}
