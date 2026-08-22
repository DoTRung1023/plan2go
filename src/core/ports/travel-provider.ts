import type { LegResolution, TravelRequest } from "../model/leg";

/**
 * Everything the time engine needs to know about getting from one point to
 * another. Implementations live in src/adapters/travel. The engine itself never
 * calls this, it is given already resolved legs, so the engine stays synchronous.
 */
export interface TravelProvider {
  readonly name: string;
  estimate(request: TravelRequest): Promise<LegResolution>;
}
