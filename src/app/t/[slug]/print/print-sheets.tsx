"use client";

import { useState } from "react";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import type { DayMapSources } from "@/features/day-planner/day-map-source";
import type { ExportRequest } from "@/features/day-planner/export-request";
import { PrintedTrip } from "@/features/day-planner/printed-trip";

interface PrintSheetsProps {
  readonly title: string;
  readonly days: readonly PlannedDay[];
  readonly maps: DayMapSources;
  readonly request: ExportRequest;
}

/**
 * The sheets alone, for the server's own browser to print. It waits for the
 * root to say the sheets are finished: dealt onto pages, with every picture
 * on them arrived. Said as an attribute, because an attribute is what a
 * browser can be told to wait for.
 */
export function PrintSheets({ title, days, maps, request }: PrintSheetsProps) {
  const [pictures, setPictures] = useState(false);
  const [dealt, setDealt] = useState(false);
  return (
    <div data-sheets={pictures && dealt ? "ready" : "drawing"}>
      <PrintedTrip
        title={title}
        days={days}
        maps={maps}
        request={request}
        visible={true}
        onReady={() => {
          setPictures(true);
        }}
        onSheets={() => {
          setDealt(true);
        }}
      />
    </div>
  );
}
