import Image from "next/image";
// Imported rather than served from public/, so Next sizes and hashes it.
import lockup from "../../../logo/logo+text.png";
import { CreateTripForm } from "./create-trip-form";

/** The zone list is read on the server so the browser is not asked to build it. */
function timeZones(): readonly string[] {
  return Intl.supportedValuesOf("timeZone");
}

export default function MarketingPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-16">
      <h1>
        <Image src={lockup} alt="plan2go" width={300} height={111} priority />
      </h1>
      <p className="mt-4 text-body text-ink-muted">
        Drop the places you want to visit on a map, see how far apart they really are, and
        reorder the day until it works. No account needed.
      </p>

      <CreateTripForm timeZones={timeZones()} today={today} />

      <p className="mt-6 text-meta text-ink-faint">
        Your trip lives at its own link. Keep the link and you can come back to it.
      </p>
    </main>
  );
}
