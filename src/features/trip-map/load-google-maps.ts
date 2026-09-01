/**
 * The browser key. This one is exposed on purpose: the Maps JavaScript API
 * authenticates from the page, so there is no way to draw an interactive Google
 * map without shipping a key. It is a different key from GOOGLE_MAPS_API_KEY,
 * restricted in the Google Cloud console to the Maps JavaScript API and to our
 * own referrers, and it buys nothing else. The Places and Routes key stays on
 * the server and never appears here.
 */
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

/** Named on window because the Maps script reports readiness by calling it. */
const CALLBACK = "plan2goGoogleMapsReady";

/**
 * One load per document, however many maps ask for it. React mounts an effect
 * twice in development, so this has to be idempotent or the script lands twice.
 */
let loading: Promise<typeof google.maps> | null = null;

export function googleMapsBrowserKey(): string | null {
  const key = BROWSER_KEY.trim();
  return key === "" ? null : key;
}

export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  loading ??= new Promise<typeof google.maps>((resolve, reject) => {
    Reflect.set(window, CALLBACK, () => {
      resolve(google.maps);
    });

    const parameters = new URLSearchParams({
      key,
      v: "quarterly",
      loading: "async",
      callback: CALLBACK,
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
