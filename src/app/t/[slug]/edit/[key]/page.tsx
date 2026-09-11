import { notFound } from "next/navigation";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { TripPage } from "../../trip-page";

/**
 * The edit link: the key in the URL is the whole of the authority.
 *
 * A key that does not match is given the same page as a slug that does not
 * exist. Saying "wrong key" out loud would confirm the trip is there, which
 * turns this URL into a way to test slugs.
 */
export default async function TripEditPage({
  params,
}: {
  params: Promise<{ slug: string; key: string }>;
}) {
  const { slug, key } = await params;

  // The check and the read are two round trips to the same database, and the
  // read is of a trip anyone holding the plain link may read anyway, so the
  // two go out together rather than one behind the other.
  const [access, trip] = await Promise.all([
    checkEditAccess({ slug, presentedKey: key, repository: prismaTripRepository }),
    prismaTripRepository.findBySlug(slug),
  ]);
  if (access.status !== "granted" || trip === null) {
    notFound();
  }

  return <TripPage trip={trip} editKey={key} />;
}
