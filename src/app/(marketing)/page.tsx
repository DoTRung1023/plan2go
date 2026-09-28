import Image from "next/image";
// Imported rather than served from public/, so Next sizes and hashes it.
import lockup from "../../../logo/logo-text.png";
import { CreateTripForm } from "./create-trip-form";

/**
 * Built once and served as it is, from the edge nearest the reader, rather
 * than drawn afresh on every visit. Nothing on it depends on who is asking:
 * today, which the form opens on, is read from the reader's own clock in the
 * browser, and the zone a trip keeps is decided when it is opened.
 */
export default function MarketingPage() {
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
    <div className="grid items-start gap-14 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
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
          Plan it, sort it, share it.
        </h1>

        <p className="max-w-[34ch] text-[17px] leading-[1.65] text-pretty text-ink-muted">
          Drop in your spots, sort out the order, and see if the day actually works.
          When it&apos;s ready, export it as a clean PDF to share with whoever&apos;s coming.
        </p>
      </div>

      <CreateTripForm />
    </div>
  );
}
