import type { DayPlan } from "@/core/model/day";

interface EmptyDayProps {
  readonly day: DayPlan;
}

export function EmptyDay({ day }: EmptyDayProps) {
  return (
    <section
      id={`day-panel-${day.id}`}
      role="tabpanel"
      aria-labelledby={`day-tab-${day.id}`}
      tabIndex={0}
      className="rounded-b-card border border-t-0 border-rule bg-paper-raised px-5 py-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <h2 className="font-display text-place font-semibold text-ink">
        Nothing planned for this day yet
      </h2>
      <p className="mt-2 text-body text-ink-muted">
        Stops appear here in the order you visit them, with the travel time between each
        one and the time you get back.
      </p>
    </section>
  );
}
