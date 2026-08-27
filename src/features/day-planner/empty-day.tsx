export function EmptyDay() {
  return (
    <div className="rounded-card border border-rule bg-paper-raised px-5 py-10">
      <h2 className="font-display text-place font-semibold text-ink">
        Nothing planned for this day yet
      </h2>
      <p className="mt-2 text-body text-ink-muted">
        Stops appear here in the order you visit them, with the travel time between each
        one and the time you get back.
      </p>
    </div>
  );
}
