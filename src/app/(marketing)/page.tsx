import Image from "next/image";
// Imported rather than served from public/, so Next sizes and hashes it.
import lockup from "../../../logo/logo-text.png";
import { CreateTripForm } from "./create-trip-form";

import type { Choice } from "./choice-field";
import { countries } from "./countries";

/** Both lists are read on the server so the browser is not asked to build them. */
function timeZones(): readonly Choice[] {
  return Intl.supportedValuesOf("timeZone").map((zone) => ({
    value: zone,
    label: zone.replace(/_/g, " "),
  }));
}

function countryChoices(): readonly Choice[] {
  return countries().map((country) => ({ value: country.code, label: country.name }));
}

/** Reads a clock, so it is worked out per request rather than at build time. */
export const dynamic = "force-dynamic";

export default function MarketingPage() {
  const today = new Date().toISOString().slice(0, 10);

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

      <CreateTripForm
        countries={countryChoices()}
        timeZones={timeZones()}
        today={today}
      />
    </>
  );
}
