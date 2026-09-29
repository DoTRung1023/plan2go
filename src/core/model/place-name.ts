/**
 * A name without its accents, with the Vietnamese đ as the d it is written as
 * without them, in lower case.
 */
export function plainName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

/**
 * A name as it is compared: plain, without the word for what kind of place
 * it is that the provider writes on some names and not others, and without
 * its spaces, so "Huế" and "Thành phố Huế", "Hue" and "Hue City", "Quang Binh
 * Province" and "Quảng Bình", and "Hà Nội" and "Hanoi" are one place.
 */
export function foldedName(name: string): string {
  return plainName(name)
    .trim()
    .replace(/^(thanh pho|tinh|huyen|thi xa) /, "")
    .replace(/ (province|district|city)$/, "")
    .replace(/\s+/g, "");
}
