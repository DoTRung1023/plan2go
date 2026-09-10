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
    /*
     * What the product is on one side, the form that starts one on the other.
     * The columns are auto-fit rather than a breakpoint, so the pair splits when
     * there is room for both and stacks when there is not, without this page
     * having to name the width at which that happens.
     *
     * Aligned along their tops, as the canvas has them: the lockup sits level
     * with the top of the card, and the words hang from it. The pair as a whole
     * is centred in the page by the layout around it, so what is left over
     * below the shorter column is shared out above and beneath the pair rather
     * than piled under it.
     */
    <div className="grid items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
      <div className="flex flex-col gap-[26px] pt-[6px]">
        <Image
          src={lockup}
          alt="plan2go"
          width={300}
          height={111}
          priority
          className="h-auto w-[min(300px,80%)]"
        />

        <h1 className="font-display text-[clamp(28px,3.2vw,42px)] leading-[1.14] font-semibold tracking-[-0.01em] text-pretty text-ink">
          Plan one day at a time.
        </h1>

        <p className="max-w-[34ch] text-[17px] leading-[1.65] text-pretty text-ink-muted">
          Add the places you want to visit and see what the day actually takes: how far
          apart they are, how long you spend getting between them, and what time you
          would arrive. If a place is shut when you get there, it says so.
        </p>
      </div>

      <CreateTripForm countries={countryChoices()} today={today} />
    </div>
  );
}
