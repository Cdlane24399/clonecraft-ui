import puppeteer from "puppeteer-core";
import { env } from "../env";

/**
 * Scroll the full height of the page in steps so lazy-loaded images and CSS
 * background-images render before we screenshot, then return to the top.
 */
async function autoScroll(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const step = 600;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, step);
        total += step;
        if (total >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
}

// Anthropic rejects images whose longest edge exceeds 8000px, so full-page
// shots are clamped well under that while still capturing deep backgrounds.
const MAX_SHOT_HEIGHT = 7600;

/**
 * Capture as much of the page as possible (deep enough to include below-the-fold
 * backgrounds) without exceeding the vision model's max image dimensions.
 */
async function boundedFullPageShot(page: import("puppeteer-core").Page): Promise<string> {
  const width = 1440;
  const fullHeight = await page.evaluate(
    () => document.documentElement.scrollHeight || document.body.scrollHeight || window.innerHeight
  );
  const height = Math.min(fullHeight, MAX_SHOT_HEIGHT);
  return (await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width, height },
    encoding: "base64",
  })) as string;
}

export type CaptureResult = {
  title: string;
  finalUrl: string;
  screenshotBase64: string;
  html: string;
  text: string;
  links: string[];
};

function browserlessEndpoint() {
  const base = env.BROWSERLESS_WS_URL.replace(/\/$/, "");
  return `${base}?token=${env.BROWSERLESS_API_KEY}`;
}

/**
 * Connect to the hosted Browserless Chromium, load `url`, and capture a
 * full-page screenshot plus DOM/text/links. One browser connection per call.
 */
export async function capturePage(url: string): Promise<CaptureResult> {
  const browser = await puppeteer.connect({ browserWSEndpoint: browserlessEndpoint() });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: env.CRAWL_NAV_TIMEOUT_MS });

    const title = await page.title();
    const finalUrl = page.url();
    const html = await page.content();

    const { text, links } = await page.evaluate((origin: string) => {
      const bodyText = (document.body?.innerText ?? "").slice(0, 20000);
      const seen = new Set<string>();
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        try {
          const href = new URL((a as HTMLAnchorElement).href, location.href);
          if (href.origin === origin) {
            href.hash = "";
            seen.add(href.pathname);
          }
        } catch {
          /* ignore malformed hrefs */
        }
      }
      return { text: bodyText, links: Array.from(seen) };
    }, new URL(finalUrl).origin);

    // Trigger lazy backgrounds/images, then capture deep into the page so
    // below-the-fold backgrounds are part of the screenshot.
    await autoScroll(page);
    const shot = await boundedFullPageShot(page);

    return { title, finalUrl, screenshotBase64: shot, html, text, links };
  } finally {
    await browser.close();
  }
}

/**
 * Screenshot an already-running app (e.g. the e2b preview URL) so we can show
 * the rendered clone next to the captured original. Returns base64 PNG.
 */
export async function screenshotUrl(url: string): Promise<string> {
  const browser = await puppeteer.connect({ browserWSEndpoint: browserlessEndpoint() });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: env.CRAWL_NAV_TIMEOUT_MS });
    // Give the Tailwind CDN runtime a beat to inject generated styles.
    await new Promise((r) => setTimeout(r, 1500));
    await autoScroll(page);
    return await boundedFullPageShot(page);
  } finally {
    await browser.close();
  }
}
