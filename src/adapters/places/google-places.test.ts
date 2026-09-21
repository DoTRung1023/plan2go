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
