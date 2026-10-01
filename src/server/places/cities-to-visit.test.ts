import { describe, expect, it } from "vitest";
import { metersBetween } from "@/core/model/distance";
import { foldedName } from "@/core/model/place-name";
import type { LatLng } from "@/core/model/place";
import type { LandmarkPlace, PlaceSearchRequest, PlaceSuggestion, PlacesProvider } from "@/core/ports/places-provider";
import {
  boxesAround,
  countryOf,
  groupedByPlace,
  inTurn,
  namesFor,
  nearestFirst,
  townFor,
  townOf,
} from "./cities-to-visit";

const ADELAIDE: LatLng = { lat: -34.9285, lng: 138.6007 };
const PO_NAGAR: LatLng = { lat: 12.265, lng: 109.195 };
const SON_DOONG: LatLng = { lat: 17.465, lng: 106.287 };
const PHONG_NHA: LatLng = { lat: 17.478, lng: 106.134 };

function landmark(
  position: LatLng,
  locality: string | null,
  region: string | null,
  district: string | null = null,
): LandmarkPlace {
  return { name: "A landmark", position, locality, district, region, country: "Vietnam" };
}

function placed(name: string, position: LatLng) {
  return { city: { providerPlaceId: `id-${name}`, name, address: null, distanceMeters: null }, position };
}

/**
 * A provider that knows some towns and where they are, and answers a search
 * for towns with every one whose name starts with what was typed, measured
 * from where it was asked near, as the provider does. Counts what was asked.
 */
function knowing(towns: readonly { readonly name: string; readonly at: LatLng }[]) {
  const asked: string[] = [];
  const unstubbed = (): Promise<never> => Promise.reject(new Error("Not stubbed"));
  const provider: PlacesProvider = {
    name: "stub",
    search: (request: PlaceSearchRequest): Promise<readonly PlaceSuggestion[]> => {
      asked.push(request.query);
      const near = request.near;
      return Promise.resolve(
        towns
          .filter((town) => foldedName(town.name).startsWith(foldedName(request.query)))
          .map((town) => ({
            providerPlaceId: `id-${town.name}-${String(town.at.lat)}`,
            name: town.name,
            address: null,
            distanceMeters: near === null ? null : metersBetween(near, town.at),
          })),
      );
    },
    nearby: unstubbed,
    landmarks: unstubbed,
    details: unstubbed,
    card: unstubbed,
    photo: unstubbed,
  };
  return { provider, asked };
}

describe("townOf", () => {
  it("is the town a ward is named for", () => {
    expect(townOf("Bắc Nha Trang")).toBe("Nha Trang");
    expect(townOf("Bac NHA Trang")).toBe("NHA Trang");
    expect(townOf("Tay Hoa Lu")).toBe("Hoa Lu");
    expect(townOf("Xuân Hương - Đà Lạt")).toBe("Đà Lạt");
  });

  it("is nothing for a name that is not a ward's", () => {
    expect(townOf("Đồng Nai")).toBeNull();
    expect(townOf("Bạc Liêu")).toBeNull();
    expect(townOf("Sa Pa")).toBeNull();
    expect(townOf("Hahndorf")).toBeNull();
    expect(townOf("Nam")).toBeNull();
    expect(townOf("West Palm Beach")).toBeNull();
  });
});

describe("groupedByPlace", () => {
  it("puts landmarks close together in one group, the biggest group first", () => {
    const hue = landmark({ lat: 16.47, lng: 107.58 }, "Hue", "Hue");
    const groups = groupedByPlace([
      hue,
      landmark(SON_DOONG, "Thượng Trạch", "Quảng Bình"),
      landmark(PHONG_NHA, null, "Quang Binh Province"),
    ]);
    expect(groups.map((group) => group.length)).toEqual([2, 1]);
    expect(groups[1]).toEqual([hue]);
  });

  it("keeps the provider's order between groups with as many landmarks", () => {
    const hue = landmark({ lat: 16.47, lng: 107.58 }, "Hue", "Hue");
    const sapa = landmark({ lat: 22.31, lng: 103.88 }, "Sa Pa", "Lào Cai");
    expect(groupedByPlace([hue, sapa]).map(([first]) => first?.locality)).toEqual(["Hue", "Sa Pa"]);
  });
});

describe("namesFor", () => {
  const names = (group: readonly LandmarkPlace[]) => namesFor(group).map(({ name }) => name);

  it("tries the province, then a ward as the town it is named for, then the ward", () => {
    expect(namesFor([landmark(PO_NAGAR, "Bắc Nha Trang", "Khánh Hòa")])).toEqual([
      { name: "Khánh Hòa", province: true },
      { name: "Nha Trang", province: false },
      { name: "Bắc Nha Trang", province: false },
    ]);
  });

  it("tries the most named town before the district", () => {
    const group = [
      landmark(SON_DOONG, "Thượng Trạch", "Quảng Bình", "Bố Trạch"),
      landmark(PHONG_NHA, null, "Quang Binh Province"),
    ];
    expect(names(group)).toEqual(["Quảng Bình", "Thượng Trạch", "Bố Trạch"]);
  });

  it("tries only the province most of them are in first, and the others last", () => {
    const group = [
      landmark({ lat: 10.93, lng: 108.28 }, "Mũi Né", "Lâm Đồng"),
      landmark({ lat: 10.93, lng: 108.1 }, "Phan Thiết", "Bình Thuận"),
      landmark({ lat: 10.94, lng: 108.2 }, "Phan Thiết", "Lâm Đồng"),
    ];
    expect(names(group)).toEqual(["Lâm Đồng", "Phan Thiết", "Mũi Né", "Bình Thuận"]);
  });

  it("tries the wards of one town as that town once", () => {
    const group = [
      landmark({ lat: 11.94, lng: 108.44 }, "Xuân Hương - Đà Lạt", "Lâm Đồng"),
      landmark({ lat: 11.95, lng: 108.43 }, "Lam Vien - Da Lat", "Lam Dong"),
    ];
    expect(names(group)).toEqual(["Lâm Đồng", "Đà Lạt", "Xuân Hương - Đà Lạt", "Lam Vien - Da Lat"]);
  });
});

describe("townFor", () => {
  it("takes a town of the name near the landmarks, not one of the same name far away", async () => {
    const { provider, asked } = knowing([
      { name: "Quảng Bình", at: { lat: 19.673, lng: 105.811 } },
      { name: "Phong Nha", at: { lat: 17.59, lng: 106.28 } },
    ]);
    const group = [
      landmark(PHONG_NHA, "Phong Nha", "Quang Binh Province"),
      landmark(SON_DOONG, "Thượng Trạch", "Quảng Bình"),
    ];
    expect((await townFor(group, provider))?.name).toBe("Phong Nha");
    expect(asked).toEqual(["Quang Binh Province", "Phong Nha", "Thượng Trạch"]);
  });

  it("takes the first name that matches, though every name was asked at once", async () => {
    const { provider } = knowing([
      { name: "Phong Nha", at: { lat: 17.59, lng: 106.28 } },
      { name: "Thượng Trạch", at: { lat: 17.47, lng: 106.29 } },
    ]);
    const group = [
      landmark(PHONG_NHA, "Phong Nha", null),
      landmark(SON_DOONG, "Thượng Trạch", null),
    ];
    expect((await townFor(group, provider))?.name).toBe("Phong Nha");
  });

  it("takes the town a ward is named for", async () => {
    const { provider } = knowing([
      { name: "Bắc Nha Trang", at: { lat: 12.324, lng: 109.176 } },
      { name: "Nha Trang", at: { lat: 12.241, lng: 109.196 } },
    ]);
    expect((await townFor([landmark(PO_NAGAR, "Bắc Nha Trang", "Khánh Hòa")], provider))?.name).toBe("Nha Trang");
  });

  it("takes only a town called what was asked, not one that starts the same", async () => {
    const { provider } = knowing([
      { name: "Ninh Hòa", at: { lat: 11.32, lng: 106.1 } },
      { name: "Tây Ninh", at: { lat: 11.31, lng: 106.1 } },
    ]);
    const group = [landmark({ lat: 11.3, lng: 106.1 }, "Tây Ninh", null)];
    expect((await townFor(group, provider))?.name).toBe("Tây Ninh");
  });

  it("takes the province when it is the city the landmarks are in", async () => {
    const { provider } = knowing([
      { name: "Cần Thơ", at: { lat: 10.03, lng: 105.78 } },
      { name: "Bình Thủy", at: { lat: 10.07, lng: 105.75 } },
    ]);
    const group = [landmark({ lat: 10.07, lng: 105.75 }, "Bình Thủy", "Cần Thơ")];
    expect((await townFor(group, provider))?.name).toBe("Cần Thơ");
  });

  it("takes the town before a city of the province's name down the road", async () => {
    const { provider } = knowing([
      { name: "Lào Cai", at: { lat: 22.485, lng: 103.97 } },
      { name: "Sa Pa", at: { lat: 22.34, lng: 103.856 } },
    ]);
    const group = [landmark({ lat: 22.314, lng: 103.877 }, "Sa Pa", "Lào Cai")];
    expect((await townFor(group, provider))?.name).toBe("Sa Pa");
  });

  it("gives up after a few names rather than searching for every one", async () => {
    const { provider, asked } = knowing([]);
    const group = [
      landmark(PO_NAGAR, "Bắc Nha Trang", "Khánh Hòa", "Diên Khánh"),
      landmark(PO_NAGAR, "Vĩnh Hải", "Khánh Hòa"),
    ];
    expect(await townFor(group, provider)).toBeNull();
    expect(asked).toHaveLength(4);
  });
});

describe("boxesAround", () => {
  it("covers the country around a point and leaves the point itself out", () => {
    const boxes = boxesAround(ADELAIDE);
    const inside = (point: LatLng) =>
      boxes.some(
        ({ low, high }) =>
          point.lat >= low.lat && point.lat <= high.lat && point.lng >= low.lng && point.lng <= high.lng,
      );
    expect(inside(ADELAIDE)).toBe(false);
    expect(inside({ lat: -35.0286, lng: 138.8078 })).toBe(true);
    expect(inside({ lat: -34.5, lng: 138.6 })).toBe(true);
    expect(inside({ lat: -34.93, lng: 140 })).toBe(true);
    expect(inside({ lat: -37.8136, lng: 144.9631 })).toBe(false);
  });
});

describe("inTurn", () => {
  it("takes the first of each list, then the second of each", () => {
    expect(inTurn([["n1", "n2", "n3"], ["s1"], [], ["w1", "w2"]])).toEqual(["n1", "s1", "w1", "n2", "w2", "n3"]);
  });
});

describe("nearestFirst", () => {
  const MELBOURNE = placed("Melbourne", { lat: -37.8136, lng: 144.9631 });
  const HAHNDORF = placed("Hahndorf", { lat: -35.0286, lng: 138.8078 });
  const PERTH = placed("Perth", { lat: -31.9523, lng: 115.8613 });

  it("puts the cities in order of how far they are", () => {
    const cities = nearestFirst(ADELAIDE, [MELBOURNE, PERTH, HAHNDORF], 8);
    expect(cities.map((city) => city.name)).toEqual(["Hahndorf", "Melbourne", "Perth"]);
  });

  it("says how far each is from the point", () => {
    const [hahndorf] = nearestFirst(ADELAIDE, [HAHNDORF], 8);
    expect(hahndorf?.distanceMeters).toBeGreaterThan(20_000);
    expect(hahndorf?.distanceMeters).toBeLessThan(25_000);
  });

  it("leaves out a place so close it is the city itself", () => {
    const glenelg = placed("Glenelg", { lat: -34.9803, lng: 138.5083 });
    expect(nearestFirst(ADELAIDE, [glenelg, HAHNDORF], 8).map((city) => city.name)).toEqual([
      "Hahndorf",
    ]);
  });

  it("keeps the nearest when there are more than asked for", () => {
    const cities = nearestFirst(ADELAIDE, [PERTH, MELBOURNE, HAHNDORF], 2);
    expect(cities.map((city) => city.name)).toEqual(["Hahndorf", "Melbourne"]);
  });
});

describe("countryOf", () => {
  it("is the last part of an address", () => {
    expect(countryOf("Hanoi, Ha Noi, Vietnam")).toBe("Vietnam");
    expect(countryOf("Kyoto, Japan")).toBe("Japan");
  });

  it("is nothing for no address", () => {
    expect(countryOf(null)).toBeNull();
    expect(countryOf("")).toBeNull();
  });
});
