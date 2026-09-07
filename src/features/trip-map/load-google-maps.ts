/**
 * The browser key. This one is exposed on purpose: the Maps JavaScript API
 * authenticates from the page, so there is no way to draw an interactive Google
 * map without shipping a key. It is a different key from GOOGLE_MAPS_API_KEY,
 * restricted in the Google Cloud console to the Maps JavaScript API and to our
 * own referrers, and it buys nothing else. The Places and Routes key stays on
 * the server and never appears here.
 */
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

/** Every label on the map, whoever is reading it. */
const MAP_LANGUAGE = "en";

/** Named on window because the Maps script reports readiness by calling it. */
const CALLBACK = "plan2goGoogleMapsReady";

/**
 * Also named on window, and not by us: this is the one hook Google gives for a
 * key it will not accept, and the name is fixed on their side.
 */
const AUTH_FAILURE = "gm_authFailure";

/**
 * One load per document, however many maps ask for it. React mounts an effect
 * twice in development, so this has to be idempotent or the script lands twice.
 */
let loading: Promise<typeof google.maps> | null = null;

/** Set once Google has refused the key, so a later watcher still hears about it. */
let refused = false;

const watchers = new Set<() => void>();

export function googleMapsBrowserKey(): string | null {
  const key = BROWSER_KEY.trim();
  return key === "" ? null : key;
}

/**
 * Google refuses a key late and quietly. The script is served, the ready
 * callback runs, `new maps.Map` draws a frame, and only then does Google grey
 * that frame out and write "Oops! Something went wrong" across it in its own
 * words. The load promise has resolved by then, so the failure never reaches
 * the caller and the page is left showing Google's message instead of ours.
 * This is the only notice of it, and it carries no argument saying which
 * refusal it was: the reason is written to the console and nowhere else.
 *
 * Returns the way to stop listening.
 */
export function onGoogleMapsRefused(watcher: () => void): () => void {
  if (refused) {
    watcher();
    return () => {};
  }

  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  loading ??= new Promise<typeof google.maps>((resolve, reject) => {
    Reflect.set(window, CALLBACK, () => {
      resolve(google.maps);
    });

    Reflect.set(window, AUTH_FAILURE, () => {
      refused = true;
      // Said plainly here because Google's own console line names the error but
      // not what to do about it, and the address that has to be allowed is only
      // known at the moment it is refused. Preview deployments get a fresh host
      // per branch, so this is the line that will be read most often.
      console.error(
        `Google Maps refused the browser key for ${window.location.origin}. ` +
          "Add this origin to the key's HTTP referrer restrictions in the " +
          "Google Cloud console, or the map cannot be drawn here.",
      );
      for (const watcher of watchers) {
        watcher();
      }
    });

    const parameters = new URLSearchParams({
      key,
      v: "quarterly",
      loading: "async",
      callback: CALLBACK,
      // Asked for rather than left to the browser. Without it the map is
      // labelled in whatever language the reader's browser is set to, so the
      // same trip reads differently depending on who opens the link, and the
      // names on the map stop matching the names in the list beside it.
      language: MAP_LANGUAGE,
    });

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${parameters.toString()}`;
    script.async = true;
    script.addEventListener("error", () => {
      // Left for the next attempt to retry rather than caching the failure.
      loading = null;
      reject(new Error("The Google Maps script could not be loaded."));
    });

    document.head.append(script);
  });

  return loading;
}
