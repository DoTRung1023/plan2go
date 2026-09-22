import { describe, expect, it } from "vitest";
import { attachmentDisposition } from "./attachment";

describe("attachmentDisposition", () => {
  it("names the file twice, plainly and encoded", () => {
    expect(attachmentDisposition("Hanoi in five days - Day 3", "pdf")).toBe(
      `attachment; filename="Hanoi in five days - Day 3.pdf"; filename*=UTF-8''Hanoi%20in%20five%20days%20-%20Day%203.pdf`,
    );
  });

  it("takes the accents off for the plain copy and keeps them in the other", () => {
    const header = attachmentDisposition("Nhà hát Lớn Hà Nội", "pdf");
    expect(header).toContain(`filename="Nha hat Lon Ha Noi.pdf"`);
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("Nhà hát Lớn Hà Nội")}.pdf`);
  });

  it("lets nothing through that would end the header or the name early", () => {
    const header = attachmentDisposition('a"b\\c/d\ne', "pdf");
    expect(header).toContain(`filename="a b c d e.pdf"`);
    expect(header).not.toMatch(/[\n\\]/);
  });

  it("falls back to Trip when nothing is left of the name", () => {
    expect(attachmentDisposition("   ", "pdf")).toContain(`filename="Trip.pdf"`);
    expect(attachmentDisposition("日本", "pdf")).toContain(`filename="Trip.pdf"`);
    expect(attachmentDisposition("日本", "pdf")).toContain(
      `filename*=UTF-8''${encodeURIComponent("日本")}.pdf`,
    );
  });

  it("encodes what encodeURIComponent leaves alone but the header does not", () => {
    expect(attachmentDisposition("Day (1)*", "pdf")).toContain(`filename*=UTF-8''Day%20%281%29%2A.pdf`);
  });
});
