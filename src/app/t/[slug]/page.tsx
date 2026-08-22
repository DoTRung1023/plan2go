import { DayPlanner } from "@/features/day-planner/day-planner";
import { PLACEHOLDER_TRIP } from "@/features/day-planner/placeholder-trip";

export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DayPlanner trip={{ ...PLACEHOLDER_TRIP, slug }} />;
}
