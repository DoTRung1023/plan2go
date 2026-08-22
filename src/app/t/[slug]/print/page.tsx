export default async function TripPrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <main>Printable itinerary for trip {slug}.</main>;
}
