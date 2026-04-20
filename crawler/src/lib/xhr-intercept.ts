import type { Page, Response } from "playwright";
import { log } from "./logger.js";

export type UrlPattern = string | RegExp;

export function matchesUrlPattern(url: string, pattern: UrlPattern): boolean {
  if (typeof pattern === "string") return url.includes(pattern);
  return pattern.test(url);
}

export function captureFirstMatchingResponse<T = unknown>(
  page: Page,
  pattern: UrlPattern,
  timeoutMs = 30_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off("response", handler);
      reject(new Error(`XHR timeout (${timeoutMs}ms) for pattern: ${pattern}`));
    }, timeoutMs);

    const handler = async (resp: Response) => {
      if (!matchesUrlPattern(resp.url(), pattern)) return;
      if (resp.status() !== 200) {
        log.warn(`Matched URL but status ${resp.status()}: ${resp.url()}`);
        return;
      }
      try {
        const body = (await resp.json()) as T;
        clearTimeout(timer);
        page.off("response", handler);
        resolve(body);
      } catch (e) {
        log.warn(`JSON parse failed for ${resp.url()}: ${(e as Error).message}`);
      }
    };

    page.on("response", handler);
  });
}
