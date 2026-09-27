import { PinIcon, SearchIcon } from "@/ui/icons";

interface EmptyDayProps {
  /** The day as it is written in the tabs, so the sentence names it. */
  readonly dayName: string;
  /**
   * Takes the reader to the search field. Null for a reader who cannot edit,
   * who is told where places come from and offered nothing to press.
   */
  readonly onFindPlace: (() => void) | null;
}

export function EmptyDay({ dayName, onFindPlace }: EmptyDayProps) {
  return (
    /*
     * Centred, and it sits between the two ends of the day rather than in
     * place of them: a day with nowhere to go still has somewhere to start
     * from, and the buttons for those are above and below this. Straight on
     * the ground with no card under it, because a card on this panel is a
     * stop and there is no stop here yet.
     */
    <div className="flex flex-col items-center gap-[13px] px-6 py-10 text-center">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-pill border-[1.5px] border-dashed border-rule-strong text-ink-faint">
        <PinIcon size={19} strokeWidth={2.4} />
      </span>
      <h2 className="font-display text-title text-balance text-ink">
        Nothing planned for {dayName} yet
      </h2>
      <p className="max-w-[38ch] text-body text-balance text-ink-muted">
        Search for a place, have a look at it, and add it to the day.
      </p>
      {onFindPlace === null ? null : (
        /* The search field is over the map, which on a desk is the other
           pane and on a phone is a strip above this: either way it is not
           where the eye is, so the empty day points at it. */
        /* The same action as the next number on the rail at the foot of the
           last card, in the state of the day with no card to hang it from:
           here it is the one thing to do, so it is the accent's solid pill
           rather than a slot on a thread that has not started yet. */
        <button
          type="button"
          onClick={onFindPlace}
          className="mt-[6px] flex h-10 items-center gap-2 rounded-pill bg-terracotta px-5 text-small/none font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <SearchIcon size={14} strokeWidth={2.75} />
          Find a place
        </button>
      )}
    </div>
  );
}
