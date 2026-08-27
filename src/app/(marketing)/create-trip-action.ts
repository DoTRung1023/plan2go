"use server";

import { redirect } from "next/navigation";
import { setEditToken } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { createTrip } from "@/server/trips/create-trip";
import { newTripInputSchema } from "@/server/trips/new-trip-input";

export interface CreateTripFormState {
  readonly error: string | null;
}

export const NO_ERROR: CreateTripFormState = { error: null };

export async function createTripAction(
  _previous: CreateTripFormState,
  formData: FormData,
): Promise<CreateTripFormState> {
  const parsed = newTripInputSchema.safeParse({
    title: formData.get("title"),
    timeZone: formData.get("timeZone"),
    startDate: formData.get("startDate"),
    dayCount: formData.get("dayCount"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first === undefined ? "Check the form and send it again." : first.message };
  }

  const { slug, editToken } = await createTrip(parsed.data, prismaTripRepository);
  await setEditToken(editToken);
  redirect(`/t/${slug}`);
}
