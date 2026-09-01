import Link from "next/link";

export default function TripNotFound() {
  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <h1 className="font-display text-time-lead font-semibold text-ink">
        No trip at this link
      </h1>
      <p className="mt-3 text-body text-ink-muted">
        The link may have a character wrong, or the trip may have been removed. Check the
        link you were sent, or open your own planner.
      </p>
      <p className="mt-6">
        <Link
          href="/"
          prefetch={false}
          className="text-body font-semibold text-terracotta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Start planning
        </Link>
      </p>
    </main>
  );
}
