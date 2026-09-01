"use server";

import { revalidatePath } from "next/cache";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { readEditToken } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { tripSettingsSchema } from "@/server/trips/trip-settings-input";
import { updateTripSettings } from "@/server/trips/update-trip-settings";

export interface TripSettingsState {
  readonly saved: boolean;
  readonly error: string | null;
}

/**
 * A mutation, so it verifies the edit token before it writes anything. Someone
 * reading a shared link is not offered this form at all, and is told the same
 * thing either way if they send it anyway.
 */
export async function updateTripAction(
  _previous: TripSettingsState,
  formData: FormData,
): Promise<TripSettingsState> {
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

  const access = await checkEditAccess({
    slug: parsed.data.slug,
    presentedToken: await readEditToken(),
    repository: prismaTripRepository,
  });

  if (access.status !== "granted") {
    return {
      saved: false,
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  const result = await updateTripSettings(parsed.data, prismaTripRepository);
  if (result.status === "no-such-trip") {
    return { saved: false, error: "This trip is no longer here. Reload the page." };
  }

  revalidatePath(`/t/${parsed.data.slug}`);
  return { saved: true, error: null };
}
