import { NewTripForm } from "./new-trip-form";

/** The zone list is read on the server so the browser is not asked to build it. */
function timeZones(): readonly string[] {
  return Intl.supportedValuesOf("timeZone");
}

export default function MarketingPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-16">
      <h1 className="font-display text-time-lead font-semibold text-ink">plan2go</h1>
      <p className="mt-3 text-body text-ink-muted">
        Drop the places you want to visit on a map, see how far apart they really are, and
        reorder the day until it works. No account needed.
      </p>

      <NewTripForm timeZones={timeZones()} today={today} />

      <p className="mt-6 text-meta text-ink-faint">
        Your trip lives at its own link. Keep the link and you can come back to it.
      </p>
    </main>
  );
}
