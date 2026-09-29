import { describe, expect, it } from "vitest";
import { foldedName, plainName } from "./place-name";

describe("plainName", () => {
  it("is the name without its accents, in lower case", () => {
    expect(plainName("Đà Lạt")).toBe("da lat");
    expect(plainName("Hahndorf")).toBe("hahndorf");
  });
});

describe("foldedName", () => {
  it("is one name with and without its accents, its spaces and the word for its kind", () => {
    expect(foldedName("Thành phố Huế")).toBe(foldedName("Hue"));
    expect(foldedName("Hue City")).toBe(foldedName("Huế"));
    expect(foldedName("Quang Binh Province")).toBe(foldedName("Quảng Bình"));
    expect(foldedName("Hà Nội")).toBe(foldedName("Hanoi"));
    expect(foldedName("Ho Chi Minh City")).toBe(foldedName("Hồ Chí Minh"));
    expect(foldedName("Đà Lạt")).toBe(foldedName("Da Lat"));
  });

  it("keeps two places apart that only share a word", () => {
    expect(foldedName("Tây Ninh")).not.toBe(foldedName("Ninh Hòa"));
  });
});
