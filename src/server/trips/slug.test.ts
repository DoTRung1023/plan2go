import { describe, expect, it } from "vitest";
import { createTripSlug } from "./slug";

describe("createTripSlug", () => {
  it("reads as two words and a suffix", () => {
    expect(createTripSlug()).toMatch(/^[a-z]+-[a-z]+-[a-z2-9]{10}$/);
  });

  it("leaves out the characters people misread", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(createTripSlug().split("-")[2]).not.toMatch(/[01ilo]/);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      seen.add(createTripSlug());
    }
    expect(seen.size).toBe(2000);
  });

  it("is url safe", () => {
    const slug = createTripSlug();
    expect(encodeURIComponent(slug)).toBe(slug);
  });
});
