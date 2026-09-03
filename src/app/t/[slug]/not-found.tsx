import Link from "next/link";

export default function TripNotFound() {
  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <h1 className="font-display text-title text-ink">No trip at this link</h1>
      <p className="mt-3 text-body text-ink-muted">
        The link may have a character wrong, or the trip may have been removed. Check the
        link you were sent, or open your own planner.
      </p>
      <p className="mt-6">
        <Link
          href="/"
          prefetch={false}
          className="inline-flex rounded-pill bg-terracotta px-5 py-[10px] text-body font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Start planning
        </Link>
      </p>
    </main>
  );
}
