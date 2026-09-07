import { TripPage } from "./trip-page";

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
  return <TripPage slug={slug} editKey={null} />;
}
