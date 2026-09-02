"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import lockup from "../../../../logo/logo-text.png";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { searchBias } from "@/features/place-search/search-bias";
import { TripActions } from "@/features/trip-settings/trip-actions";
import { TripSettings } from "@/features/trip-settings/trip-settings";
import { addStopAction } from "./add-stop-action";
import { clearTripAction } from "./clear-trip-action";
import { newTripAction } from "./new-trip-action";
import { updateTripAction } from "./update-trip-action";

/** Leaflet reads the document as it loads, so the map never renders on the server. */
const TripMap = dynamic(
  async () => {
    const loaded = await import("@/features/trip-map/trip-map");
    return loaded.TripMap;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-panel border border-rule bg-paper-sunken">
        <p className="text-meta text-ink-muted">Loading the map.</p>
      </div>
    ),
  },
);

interface TripEditorProps {
  readonly title: string;
  readonly slug: string;
  readonly days: readonly PlannedDay[];
  /** Whether this browser holds the edit token for the trip. */
  readonly canEdit: boolean;
}

/**
 * The two panes. Map left and list right on a desktop, and on a phone a sticky
 * strip of map above a scrolling list, which expands to the full viewport when
 * the reader asks for it.
 *
 * The selected day is held here because both panes show it and neither feature
 * may reach into the other.
 */
export function TripEditor({
  title,
  slug,
  days,
  canEdit,
}: TripEditorProps) {
  const [chosenIndex, setChosenIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Clearing the trip, or pulling its last day earlier, can leave fewer days
  // than the one being read. Without this the tab strip shows none of them as
  // chosen and the keyboard cannot reach any of them.
  const selectedIndex = Math.min(chosenIndex, days.length - 1);
  const selected = days[selectedIndex] ?? days[0];
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <main className="lg:grid lg:h-dvh lg:grid-cols-[minmax(420px,1fr)_minmax(400px,480px)]">
      <section
        aria-label="Map of this day"
        className={
          expanded
            ? "fixed inset-0 z-40 bg-paper-sunken p-3 lg:static lg:h-dvh"
            : "sticky top-0 z-20 h-[140px] bg-paper-sunken p-3 lg:static lg:h-dvh"
        }
      >
        <div className="relative h-full w-full">
          {selected === undefined ? null : (
            <TripMap
              start={selected.plan.start}
              end={selected.plan.end}
              stops={selected.plan.stops}
            />
          )}
          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded);
            }}
            className="absolute top-3 right-3 z-[1100] rounded-pill border border-rule bg-paper-raised px-4 py-2 text-meta text-ink shadow-map-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:hidden"
          >
            {expanded ? "Collapse map" : "Expand map"}
          </button>
        </div>
      </section>

      <section className="lg:h-dvh lg:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[520px] flex-wrap items-center justify-between gap-3 px-5 pt-6">
          {/* Not prefetched: "/" opens a trip, and prefetching would open it
              for a reader who never clicked. */}
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <Image src={lockup} alt="plan2go" width={150} height={55} priority />
          </Link>
          {canEdit ? (
            <TripActions
              slug={slug}
              onClear={clearTripAction}
              onStartAnother={newTripAction}
            />
          ) : null}
        </div>
        <DayPlanner
          title={title}
          days={days}
          selectedIndex={selectedIndex}
          onSelect={setChosenIndex}
          settings={
            canEdit && first !== undefined && last !== undefined ? (
              <TripSettings
                slug={slug}
                title={title}
                startDate={first.plan.date}
                endDate={last.plan.date}
                onSave={updateTripAction}
              />
            ) : null
          }
          search={
            canEdit && selected !== undefined ? (
              <PlaceSearch
                slug={slug}
                dayId={selected.plan.id}
                dayName={`Day ${String(selectedIndex + 1)}`}
                near={searchBias(
                  days.map((day) => day.plan),
                  selectedIndex,
                )}
                onAdd={addStopAction}
              />
            ) : null
          }
        />
      </section>
    </main>
  );
}
