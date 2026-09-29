import { Fraunces } from "next/font/google";

/**
 * The display face on paper, from the design for the printed trip: a heavy,
 * soft serif, set at its softest and at its smallest optical size, where it
 * is as round and as even as the face the design was drawn in. That face
 * carries no Vietnamese and this one does, which is why it is this one: a
 * place name set in a face without the marks drops out of it part way
 * through the word.
 *
 * Only the sheets use it, so it is not preloaded with every page that can
 * open them; it is fetched when a sheet is first drawn, and the server's
 * own browser waits for it before it prints.
 */
export const sheetDisplay = Fraunces({
  subsets: ["latin", "latin-ext", "vietnamese"],
  axes: ["SOFT", "opsz"],
  variable: "--font-sheet-display",
  display: "swap",
  preload: false,
});
