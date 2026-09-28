"use client";

import { useRef } from "react";
import { PlaceSearch } from "@/features/place-search/place-search";

const HANOI = {
  providerPlaceId: "ChIJoRyG2ZurNTERqRfKcnt_iOc",
  name: "Hanoi",
  position: { lat: 21.0285, lng: 105.8542 },
  color: 0,
};

export default function SearchPreview() {
  const field = useRef<HTMLInputElement | null>(null);
  const mapBox = useRef<HTMLDivElement | null>(null);
  const bare = typeof window !== "undefined" && window.location.search.includes("bare");
  const props = { mapBox };
  return (
    <main ref={mapBox} style={{ position: "relative", padding: 24, background: "#e4d9c4", minHeight: "100vh" }}>
      <div style={{ width: 376 }}>
        <PlaceSearch
          {...props}
          slug="preview"
          editKey="preview"
          dayId="day"
          dayName="Day 1"
          field={field}
          near={HANOI.position}
          dayCity={bare ? null : HANOI}
          cities={bare ? [] : [HANOI]}
          cityColorFor={() => 0}
          onChangeCity={() => Promise.resolve({ error: null })}
          onTheTrip={new Set()}
          showing={null}
          onChoose={() => undefined}
          onClear={() => undefined}
          onAdd={() => Promise.resolve({ added: "Somewhere", error: null })}
        />
      </div>
    </main>
  );
}
