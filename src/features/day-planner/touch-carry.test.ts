import { describe, expect, it } from "vitest";
import { cardUnder, edgeScroll } from "./touch-carry";

const cards = [
  { index: 0, top: 100, bottom: 260 },
  { index: 1, top: 320, bottom: 480 },
  { index: 2, top: 540, bottom: 700 },
];

describe("cardUnder", () => {
  it("is the card the finger is over", () => {
    expect(cardUnder(150, cards, 0)).toBe(0);
    expect(cardUnder(400, cards, 0)).toBe(1);
    expect(cardUnder(700, cards, 0)).toBe(2);
  });

  it("stays on the card it was last over while the finger is on a leg between two", () => {
    expect(cardUnder(290, cards, 0)).toBe(0);
    expect(cardUnder(290, cards, 1)).toBe(1);
  });

  it("is the first card above the day and the last below it", () => {
    expect(cardUnder(20, cards, 1)).toBe(0);
    expect(cardUnder(900, cards, 1)).toBe(2);
  });

  it("keeps what it had when there are no cards to be over", () => {
    expect(cardUnder(300, [], 3)).toBe(3);
  });
});

describe("edgeScroll", () => {
  it("does nothing with the finger in the middle", () => {
    expect(edgeScroll(400, 200, 800)).toBe(0);
  });

  it("runs on down near the foot and back up near the top", () => {
    expect(edgeScroll(790, 200, 800)).toBeGreaterThan(0);
    expect(edgeScroll(210, 200, 800)).toBeLessThan(0);
  });

  it("is faster the nearer the edge", () => {
    expect(edgeScroll(795, 200, 800)).toBeGreaterThan(edgeScroll(760, 200, 800));
    expect(edgeScroll(205, 200, 800)).toBeLessThan(edgeScroll(240, 200, 800));
  });

  it("goes no faster past the edge than at it", () => {
    expect(edgeScroll(900, 200, 800)).toBe(edgeScroll(800, 200, 800));
    expect(edgeScroll(100, 200, 800)).toBe(edgeScroll(200, 200, 800));
  });

  it("moves in whole pixels", () => {
    expect(Number.isInteger(edgeScroll(781, 200, 800))).toBe(true);
  });
});
