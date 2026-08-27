/**
 * The one place the Places key is read. It is server side only and must never
 * gain a NEXT_PUBLIC_ prefix, which is why nothing below this line takes it
 * from the environment itself.
 */
export function googleMapsApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return key === undefined || key.trim() === "" ? null : key;
}
