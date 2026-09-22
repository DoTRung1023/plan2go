/** "3 stops", "1 stop": a count of places, wherever a day is summed up. */
export function formatStops(count: number): string {
  return `${String(count)} ${count === 1 ? "stop" : "stops"}`;
}
