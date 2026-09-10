import { PinIcon } from "@/ui/icons";

interface EmptyDayProps {
  /** The day as it is written in the tabs, so the sentence names it. */
  readonly dayName: string;
}

export function EmptyDay({ dayName }: EmptyDayProps) {
  return (
    /*
     * Centred, and it sits between the two ends of the day rather than in
     * place of them: a day with nowhere to go still has somewhere to start
     * from, and the buttons for those are above and below this.
     */
    <div className="flex flex-col items-center gap-[13px] px-6 py-10 text-center">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-pill border-[1.5px] border-dashed border-rule-strong text-ink-faint">
        <PinIcon size={19} strokeWidth={2.4} />
      </span>
      <h2 className="font-display text-title text-balance text-ink">
        Nothing planned for {dayName} yet
      </h2>
      <p className="max-w-[38ch] text-body text-balance text-ink-muted">
        Search for a place on the map and it lands here.
      </p>
    </div>
  );
}
