import type { DayEndpoint } from "@/core/model/day";

/** The traveller's own label first, then the place it stands for. */
export function endpointName(endpoint: DayEndpoint): string {
  if (endpoint.label === null) {
    return endpoint.place.name;
  }
  return `${endpoint.label}, ${endpoint.place.name}`;
}
