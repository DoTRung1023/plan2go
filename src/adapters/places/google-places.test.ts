import { afterEach, describe, expect, it, vi } from "vitest";
import { createGooglePlacesProvider, declaredLength, toWeeklyOpeningHours } from "./google-places";

describe("toWeeklyOpeningHours", () => {
  it("says nothing when the provider gave no hours", () => {
    expect(toWeeklyOpeningHours(undefined)).toBeNull();
  });

  it("reads an ordinary weekday window", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } }],
    });
    expect(week?.[1]).toEqual([{ opensAt: 540, closesAt: 1050 }]);
  });

  it("leaves a day the provider did not mention empty, which reads as closed", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 6, hour: 7, minute: 0 }, close: { day: 6, hour: 15, minute: 0 } }],
    });
    expect(week?.[0]).toEqual([]);
    expect(week?.[6]).toEqual([{ opensAt: 420, closesAt: 900 }]);
  });

  it("carries a window that runs past midnight as a closing time beyond 1440", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
    });
    expect(week?.[5]).toEqual([{ opensAt: 1080, closesAt: 1560 }]);
    expect(week?.[6]).toEqual([]);
  });

  it("reads one period with no closing time as open around the clock, every day", () => {
    const week = toWeeklyOpeningHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] });
    for (const day of [0, 1, 2, 3, 4, 5, 6] as const) {
      expect(week?.[day]).toEqual([{ opensAt: 0, closesAt: 1440 }]);
    }
  });

  it("keeps two windows on a day that shuts for lunch", () => {
    const week = toWeeklyOpeningHours({
      periods: [
        { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 12, minute: 0 } },
        { open: { day: 2, hour: 13, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } },
      ],
    });
    expect(week?.[2]).toEqual([
      { opensAt: 540, closesAt: 720 },
      { opensAt: 780, closesAt: 1020 },
    ]);
  });
});

describe("declaredLength", () => {
  it("reads a plain byte count", () => {
    expect(declaredLength(new Headers({ "content-length": "1325275" }))).toBe(1325275);
  });

  it("says nothing when the answer did not", () => {
    expect(declaredLength(new Headers())).toBeNull();
  });

  it("does not trust a count of a body that arrived compressed", () => {
    expect(
      declaredLength(new Headers({ "content-length": "4096", "content-encoding": "gzip" })),
    ).toBeNull();
  });

  it("does not trust a count that is not a number", () => {
    expect(declaredLength(new Headers({ "content-length": "many" }))).toBeNull();
  });
});

describe("photo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hands the picture on as a stream, with its length, without reading it first", async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 3) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array([pulled, pulled, pulled]));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(body, {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": "9" },
        }),
      ),
    );

    const image = await createGooglePlacesProvider({ apiKey: "k" }).photo("places/p/photos/x", 3200);

    expect(image).not.toBeNull();
    expect(image?.contentType).toBe("image/jpeg");
    expect(image?.byteLength).toBe(9);
    // Nothing has been read on our account: the reader downstream drives it.
    expect(pulled).toBeLessThanOrEqual(1);
    const bytes = new Uint8Array(await new Response(image?.body).arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it("asks for the picture no wider than the sheet draws it", async () => {
    const fetched = vi.fn(async () => new Response(new Uint8Array([0]), { status: 200 }));
    vi.stubGlobal("fetch", fetched);

    await createGooglePlacesProvider({ apiKey: "k" }).photo("places/p/photos/x", 1600);

    const [url] = fetched.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toBe("/v1/places/p/photos/x/media");
    expect(url.searchParams.get("maxWidthPx")).toBe("1600");
  });

  it("says a picture the provider no longer has is gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    await expect(createGooglePlacesProvider({ apiKey: "k" }).photo("places/p/photos/x", 800)).resolves.toBeNull();
  });
});

describe("search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const answer = {
    suggestions: [
      {
        placePrediction: {
          placeId: "p-victor",
          distanceMeters: 62_418,
          structuredFormat: {
            mainText: { text: "Victor Harbor" },
            secondaryText: { text: "South Australia, Australia" },
          },
        },
      },
    ],
  };

  it("measures each answer from the point it was asked near", async () => {
    const fetched = vi.fn(async () => Response.json(answer));
    vi.stubGlobal("fetch", fetched);

    const found = await createGooglePlacesProvider({ apiKey: "k" }).search({
      query: "Victor",
      near: { lat: -34.93, lng: 138.6 },
      limit: 8,
      only: "cities",
      session: null,
    });

    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      origin: { latitude: -34.93, longitude: 138.6 },
    });
    expect(found).toEqual([
      {
        providerPlaceId: "p-victor",
        name: "Victor Harbor",
        address: "South Australia, Australia",
        distanceMeters: 62_418,
      },
    ]);
  });

  it("says no distance for a search asked near nowhere", async () => {
    const unmeasured = {
      suggestions: [
        { placePrediction: { placeId: "p-victor", structuredFormat: { mainText: { text: "Victor Harbor" } } } },
      ],
    };
    const fetched = vi.fn(async () => Response.json(unmeasured));
    vi.stubGlobal("fetch", fetched);

    const [found] = await createGooglePlacesProvider({ apiKey: "k" }).search({
      query: "Victor",
      near: null,
      limit: 8,
      only: "cities",
      session: null,
    });

    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("origin");
    expect(found?.distanceMeters).toBeNull();
  });

  it("asks for towns, districts, wards and provinces when cities are asked for", async () => {
    const fetched = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetched);

    await createGooglePlacesProvider({ apiKey: "k" }).search({
      query: "Tây Ninh",
      near: null,
      limit: 5,
      only: "cities",
      session: null,
    });

    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    const types: unknown = JSON.parse(String(init.body)).includedPrimaryTypes;
    expect(types).toContain("administrative_area_level_2");
    expect(types).toContain("administrative_area_level_1");
    expect(types).not.toContain("(cities)");
  });

  describe("a town filed twice", () => {
    const prediction = (
      placeId: string,
      main: string,
      secondary: string,
      types: string[],
      distanceMeters?: number,
    ) => ({
      placePrediction: {
        placeId,
        types,
        distanceMeters,
        structuredFormat: { mainText: { text: main }, secondaryText: { text: secondary } },
      },
    });
    const searchFor = async (answer: unknown, only: "cities" | null) => {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json(answer)));
      const found = await createGooglePlacesProvider({ apiKey: "k" }).search({
        query: "Hu",
        near: null,
        limit: 8,
        only,
        session: null,
      });
      return found.map((one) => one.providerPlaceId);
    };

    it("is listed once, as the city rather than the province", async () => {
      const answer = {
        suggestions: [
          prediction("p-hue-province", "Hue City", "Vietnam", ["administrative_area_level_1"]),
          prediction("p-hue", "Hue", "Vietnam", ["locality", "political"]),
        ],
      };
      expect(await searchFor(answer, "cities")).toEqual(["p-hue"]);
    });

    it("is listed once when a district and a ward are as far from the origin", async () => {
      const answer = {
        suggestions: [
          prediction("p-ward", "Hội An", "Hoi An, Da Nang, Vietnam", ["sublocality_level_1"], 591_000),
          prediction("p-other", "Hội An", "An Giang, Vietnam", ["locality"], 134_000),
          prediction("p-district", "Hội An", "Da Nang, Vietnam", ["administrative_area_level_2"], 591_400),
        ],
      };
      expect(await searchFor(answer, "cities")).toEqual(["p-ward", "p-other"]);
    });

    it("is not a town of the same name in another country", async () => {
      const answer = {
        suggestions: [
          prediction("p-china", "Tây Ninh", "Qinghai, China", ["locality"]),
          prediction("p-tay-ninh", "Tây Ninh", "Vietnam", ["administrative_area_level_1"]),
        ],
      };
      expect(await searchFor(answer, "cities")).toEqual(["p-china", "p-tay-ninh"]);
    });

    it("is never looked for among places, where two of one name are two places", async () => {
      const answer = {
        suggestions: [
          prediction("p-one", "Highlands Coffee", "Hồ Chí Minh, Vietnam", ["cafe"], 2_000),
          prediction("p-two", "Highlands Coffee", "Hồ Chí Minh, Vietnam", ["cafe"], 3_000),
        ],
      };
      expect(await searchFor(answer, null)).toEqual(["p-one", "p-two"]);
    });
  });

  it("asks for any named area, and never a province, when areas are asked for", async () => {
    const fetched = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetched);

    await createGooglePlacesProvider({ apiKey: "k" }).search({
      query: "Hội An",
      near: { lat: 15.88, lng: 108.33 },
      limit: 5,
      only: "areas",
      session: null,
    });

    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    const types: unknown = JSON.parse(String(init.body)).includedPrimaryTypes;
    expect(types).toContain("administrative_area_level_2");
    expect(types).not.toContain("administrative_area_level_1");
  });
});

describe("landmarks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a landmark whose address has a part with no types, as Google sends", async () => {
    const answer = {
      places: [
        {
          displayName: { text: "Adelaide Himeji Garden" },
          location: { latitude: -34.9365, longitude: 138.6033 },
          addressComponents: [
            { longText: "Cnr South Terrace &" },
            { longText: "Adelaide", types: ["locality", "political"] },
            { longText: "South Australia", types: ["administrative_area_level_1", "political"] },
            { longText: "Australia", types: ["country", "political"] },
          ],
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(answer)));

    const landmarks = await createGooglePlacesProvider({ apiKey: "k" }).landmarks({
      query: "best cities to visit in Australia",
      within: null,
      limit: 20,
    });

    expect(landmarks).toEqual([
      {
        name: "Adelaide Himeji Garden",
        position: { lat: -34.9365, lng: 138.6033 },
        locality: "Adelaide",
        district: null,
        region: "South Australia",
        country: "Australia",
      },
    ]);
  });

  it("holds the search to the box it is given, and leaves out a landmark with no position", async () => {
    const answer = {
      places: [
        { displayName: { text: "Somewhere" } },
        { displayName: { text: "Hahndorf Main Street" }, location: { latitude: -35.03, longitude: 138.81 } },
      ],
    };
    const fetched = vi.fn(async () => Response.json(answer));
    vi.stubGlobal("fetch", fetched);

    const landmarks = await createGooglePlacesProvider({ apiKey: "k" }).landmarks({
      query: "tourist attractions",
      within: { low: { lat: -36, lng: 138.7 }, high: { lat: -34, lng: 141 } },
      limit: 20,
    });

    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).locationRestriction).toEqual({
      rectangle: { low: { latitude: -36, longitude: 138.7 }, high: { latitude: -34, longitude: 141 } },
    });
    expect(landmarks.map((landmark) => landmark.name)).toEqual(["Hahndorf Main Street"]);
  });
});
