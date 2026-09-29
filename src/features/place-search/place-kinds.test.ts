import { describe, expect, it } from "vitest";
import { cityListWords } from "./place-kinds";

describe("cityListWords", () => {
  it("tells a kind with nothing found from a kind whose every place is on the trip", () => {
    const words = cityListWords("cafe", "Hanoi");
    expect(words.empty).toBe("No cafés turned up in Hanoi. Try typing the name of one instead.");
    expect(words.taken).toBe(
      "Everything that turned up for cafés in Hanoi is on the trip already. Try typing the name of another one.",
    );
  });

  it("says nothing about the city's best known, empty or taken, since nobody asked for it", () => {
    const words = cityListWords(null, "Hanoi");
    expect(words.empty).toBeNull();
    expect(words.taken).toBeNull();
  });
});
