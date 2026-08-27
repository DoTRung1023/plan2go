"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { addStopAction } from "./add-stop-action";

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

interface TripWorkspaceProps {
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
export function TripWorkspace({ title, slug, days, canEdit }: TripWorkspaceProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const selected = days[selectedIndex] ?? days[0];

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
        <DayPlanner
          title={title}
          days={days}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          search={
            canEdit && selected !== undefined ? (
              <PlaceSearch slug={slug} dayId={selected.plan.id} onAdd={addStopAction} />
            ) : null
          }
        />
      </section>
    </main>
  );
}
