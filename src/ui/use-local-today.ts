import { useEffect, useState } from "react";

/** How often the clock is looked at, so midnight is never more than this late. */
const LOOK_EVERY_MILLIS = 60_000;

/**
 * Today's date on this browser's clock, in the zone the browser is in, as
 * YYYY-MM-DD. Put together from the date's own parts rather than formatted
 * by a locale, which a browser short of locale data writes its own way, and
 * the form parses what this returns.
 */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Today where the reader is, for marking the day that is today for them.
 *
 * Null until the browser has said, because the server has no way of knowing
 * the reader's zone: the page arrives with no day marked and the mark comes
 * with the first render in the browser. Read again every minute and whenever
 * the tab comes back into view, so a page left open through midnight, or on
 * a laptop that slept, moves its mark without being reloaded.
 */
export function useLocalToday(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const look = (): void => {
      setToday(localToday());
    };
    look();
    const timer = window.setInterval(look, LOOK_EVERY_MILLIS);
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
    };
  }, []);

  return today;
}
