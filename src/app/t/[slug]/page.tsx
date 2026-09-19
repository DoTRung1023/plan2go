import { notFound } from "next/navigation";
import { TripPage } from "./trip-page";
import { tripBySlug, tripTitle } from "./trip-lookup";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return tripTitle(slug);
}

/**
 * The plain link: anyone holding it reads the trip and nobody changes it.
 *
 * No key is asked for and none is accepted here. Editing lives at its own URL,
 * so a link handed to the people travelling cannot quietly carry the right to
 * rewrite the trip with it.
 */
export default async function TripReadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await tripBySlug(slug);
  if (trip === null) {
    notFound();
  }
  return <TripPage trip={trip} editKey={null} />;
}
