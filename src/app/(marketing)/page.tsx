import { headers } from "next/headers";
import Image from "next/image";
// Imported rather than served from public/, so Next sizes and hashes it.
import lockup from "../../../logo/logo-text.png";
import { CreateTripForm } from "./create-trip-form";

import type { Choice } from "./choice-field";
import { openingTimeZone, todayIn } from "@/server/trips/time-zones";
import { countries } from "./countries";

/** Read on the server so the browser is not asked to build the list. */
function countryChoices(): readonly Choice[] {
  return countries().map((country) => ({ value: country.code, label: country.name }));
}

/** Reads a clock, so it is worked out per request rather than at build time. */
export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  /**
   * Today where the reader is, not today in UTC. Adelaide spends the first nine
   * and a half hours of every day being offered yesterday otherwise.
   */
  const today = todayIn(openingTimeZone(await headers()));

  return (
    <>
      <h1>
        <Image src={lockup} alt="plan2go" width={300} height={111} priority />
      </h1>
      <p className="mt-4 text-body text-ink-muted">
        Add the places you want to visit and see what the day actually takes: how far
        apart they are, how long you spend getting between them, and what time you would
        arrive. If a place is shut when you get there, it says so.
      </p>

      <CreateTripForm countries={countryChoices()} today={today} />
    </>
  );
}
