import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Browser, LaunchOptions } from "puppeteer-core";

/**
 * A page of our own, printed to a PDF by a browser of our own.
 *
 * The sheets are drawn by the same React and the same stylesheet the export
 * dialog previews them with, so the one thing left to a browser is to lay
 * them on paper. Doing that here rather than in the reader's browser means
 * the file is the same whoever asks for it, nothing of a print window is in
 * it, and it arrives as a download under its own name.
 */

/** Where the browser on a Mac is, when nothing says otherwise. */
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * How the browser is launched, which depends on where this is running: a
 * browser named by PDF_CHROME_PATH, the one built for a serverless Linux
 * where this is deployed, or the Chrome installed on a Mac, for development.
 */
async function launchOptions(): Promise<LaunchOptions> {
  const named = process.env.PDF_CHROME_PATH;
  if (named !== undefined && named.trim() !== "") {
    return { executablePath: named, headless: true };
  }
  if (process.platform === "linux") {
    // No WebGL is drawn on a sheet, and leaving the graphics stack packed
    // is a second or two off every cold start.
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: "shell",
    };
  }
  if (process.platform === "darwin" && existsSync(MAC_CHROME)) {
    return { executablePath: MAC_CHROME, headless: true };
  }
  throw new Error("No browser to print with. Set PDF_CHROME_PATH to a Chrome or Chromium.");
}

export interface PrintJob {
  /** The page to print, on this server. */
  readonly url: string;
  /** What must be on the page before it is printed: the sheets, finished. */
  readonly readySelector: string;
  /** What the page rule keeps clear on every side, told to the browser too. */
  readonly marginMm: number;
  /** How long the page has to load and finish, in milliseconds. */
  readonly timeoutMs: number;
  /**
   * Called off when whoever asked for the file has gone: the browser is
   * closed then, rather than drawing a file nobody will receive.
   */
  readonly signal?: AbortSignal;
}

/** A refusal the moment the signal is called off, or already, and nothing otherwise. */
function calledOff(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const refuse = (): void => {
      reject(new Error("The export was called off before it was printed."));
    };
    if (signal.aborted) {
      refuse();
      return;
    }
    signal.addEventListener("abort", refuse, { once: true });
  });
}

/**
 * The page, printed. The browser opens it, waits for the sheets to say they
 * are finished and for every face to have arrived, and prints it on the
 * paper the page's own rule names, with nothing of its own added.
 */
export async function printPageToPdf(job: PrintJob): Promise<Uint8Array<ArrayBuffer>> {
  job.signal?.throwIfAborted();
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch(await launchOptions());
    const printing = printWith(browser, job);
    // Called off, the race is lost at once and the browser closed under the
    // printing, whose own failure the race has already answered.
    return await (job.signal === undefined
      ? printing
      : Promise.race([printing, calledOff(job.signal)]));
  } finally {
    await browser?.close();
  }
}

/** The page opened, finished and printed in a browser already running. */
async function printWith(browser: Browser, job: PrintJob): Promise<Uint8Array<ArrayBuffer>> {
  const page = await browser.newPage();
  page.setDefaultTimeout(job.timeoutMs);
  await page.goto(job.url, { waitUntil: "networkidle0", timeout: job.timeoutMs });
  await page.waitForSelector(job.readySelector, { timeout: job.timeoutMs });
  // Every picture on the page, arrived or failed, and not only the ones
  // the sheets say they wait for: the lockup on a sheet that has no map
  // is drawn with the sheet, a moment before the sheets say they are done.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });
  await page.evaluate(() => document.fonts.ready);
  const margin = `${String(job.marginMm)}mm`;
  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: margin, right: margin, bottom: margin, left: margin },
  });
  // In a buffer of its own, which is what a response body is made of.
  return new Uint8Array(pdf);
}
