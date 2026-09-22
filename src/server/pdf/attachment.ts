/**
 * The Content-Disposition header that hands a file over as a download under
 * a name of ours.
 *
 * The name is sent twice, as the header allows: once in plain ASCII, for
 * whatever cannot read the other, and once encoded so that a name with
 * Vietnamese in it arrives as it was typed. The ASCII copy is the name with
 * its accents taken off, "Nhà hát Lớn" as "Nha hat Lon", rather than a row
 * of question marks.
 */

/** The longest a name is let run, before its extension. */
const LONGEST = 120;

/** Nothing a header, a shell or a file system would take for something else. */
function tidy(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f"\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LONGEST)
    .trim();
}

/** The name with its accents taken off and anything still outside ASCII dropped. */
function asciiOf(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^ -~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function attachmentDisposition(name: string, extension: string): string {
  const tidied = tidy(name) || "Trip";
  const ascii = asciiOf(tidied) || "Trip";
  const encoded = encodeURIComponent(tidied).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}.${extension}"; filename*=UTF-8''${encoded}.${extension}`;
}
