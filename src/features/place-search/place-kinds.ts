import type { PlaceKind } from "@/core/model/place-kind";
import {
  BagIcon,
  BasketIcon,
  BedIcon,
  CupIcon,
  LandmarkIcon,
  MoonIcon,
  MountainIcon,
  TempleIcon,
  TreesIcon,
  UtensilsIcon,
} from "@/ui/icons";

/**
 * What each kind of place is called on its chip, what it is called when there
 * are more than one, for the heading over the list, "Parks in Hanoi", and
 * the icon of what it finds. One entry for every kind, and no more, or the
 * type says so.
 */
export const KIND_WORDS = {
  cafe: { label: "Café", many: "Cafés", Icon: CupIcon },
  "street-food": { label: "Street food", many: "Street food", Icon: UtensilsIcon },
  museum: { label: "Museum", many: "Museums", Icon: LandmarkIcon },
  temple: { label: "Temple", many: "Temples", Icon: TempleIcon },
  market: { label: "Market", many: "Markets", Icon: BasketIcon },
  viewpoint: { label: "Viewpoint", many: "Viewpoints", Icon: MountainIcon },
  park: { label: "Park", many: "Parks", Icon: TreesIcon },
  nightlife: { label: "Nightlife", many: "Nightlife", Icon: MoonIcon },
  hotel: { label: "Hotel", many: "Hotels", Icon: BedIcon },
  shopping: { label: "Shopping", many: "Shopping", Icon: BagIcon },
} as const satisfies Record<
  PlaceKind,
  { readonly label: string; readonly many: string; readonly Icon: typeof CupIcon }
>;

/** What the list about a city says, over it, while it is asked about, and when it is empty. */
interface CityListWords {
  readonly heading: string;
  readonly waiting: string;
  /** Null when an empty list says nothing, and the panel is left to the chips. */
  readonly empty: string | null;
}

/**
 * The words for the list about a city: what it is known for, with no kind, or
 * the best known of one kind. The city's best known saying nothing when there
 * are none is deliberate: nobody asked for that list out loud.
 */
export function cityListWords(kind: PlaceKind | null, city: string): CityListWords {
  if (kind === null) {
    return { heading: `Popular in ${city}`, waiting: `Looking for places in ${city}.`, empty: null };
  }
  const { many } = KIND_WORDS[kind];
  const few = many.toLowerCase();
  return {
    heading: `${many} in ${city}`,
    waiting: `Looking for ${few} in ${city}.`,
    empty: `No ${few} turned up in ${city}. Try typing the name of one instead.`,
  };
}
