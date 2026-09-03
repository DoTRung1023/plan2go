import { PinIcon } from "@/ui/icons";

interface EmptyDayProps {
  /** The day as it is written in the tabs, so the sentence names it. */
  readonly dayName: string;
}

export function EmptyDay({ dayName }: EmptyDayProps) {
  return (
    <div className="flex max-w-[400px] flex-col items-start gap-[14px] pt-4">
      <div className="flex items-center gap-[13px]">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-pill border-[1.5px] border-dashed border-rule-strong text-ink-faint">
          <PinIcon size={19} strokeWidth={2.4} />
        </span>
        <h2 className="font-display text-title text-ink">
          Nothing planned for {dayName} yet
        </h2>
      </div>
      <p className="text-body text-ink-muted">
        Search for a place on the map and it lands here. Stops appear in the order you
        visit them, with the travel time between each one and the time you get back.
      </p>
    </div>
  );
}
