import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Loads the DealFlow logo from /public/logo.png and returns it as a
 * base64 data URI suitable for @react-pdf/renderer's <Image src=... />.
 *
 * Cached after first read because the file doesn't change at runtime.
 */

let cached: string | null = null;

export async function getLogoDataUrl(): Promise<string> {
  if (cached) return cached;

  const filePath = join(process.cwd(), "public", "logo.png");
  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");
  cached = `data:image/png;base64,${base64}`;
  return cached;
}