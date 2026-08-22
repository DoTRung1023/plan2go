export default async function TripViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <main>Read only view of trip {slug}.</main>;
}
