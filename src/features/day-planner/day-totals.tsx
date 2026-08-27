import type { DayTotals as Totals } from "@/core/time/compute-day";
import { formatDuration } from "@/core/time/minutes";

interface DayTotalsProps {
  readonly totals: Totals;
}

function Total({ label, minutes }: { readonly label: string; readonly minutes: number | null }) {
  return (
    <div>
      <dt className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-display text-time font-semibold text-ink tabular-nums">
        {minutes === null ? "Not known" : formatDuration(minutes)}
      </dd>
    </div>
  );
}

export function DayTotals({ totals }: DayTotalsProps) {
  return (
    <section className="mt-6 rounded-card bg-paper-sunken px-5 py-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Total label="Out for" minutes={totals.timeOutMinutes} />
        <Total label="Time at places" minutes={totals.timeAtPlacesMinutes} />
        <Total label="Getting there" minutes={totals.travelMinutes} />
        {totals.waitingMinutes === 0 ? null : (
          <Total label="Waiting" minutes={totals.waitingMinutes} />
        )}
      </dl>
    </section>
  );
}
