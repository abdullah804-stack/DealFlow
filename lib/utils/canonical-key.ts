/**
 * Canonical key — stable dedup identifier for candidates.
 * Mirrors src/memory/canonical_key.py.
 *
 * MUST produce byte-identical output for identical input. The voting
 * parity test verifies voting; this file is verified by failure-modes test.
 */

const DISCUSSION_HOSTS = new Set([
  "news.ycombinator.com",
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
]);

function extractHost(url: string): string | null {
  try {
    let candidate = url;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
      candidate = "https://" + candidate;
    }
    const parsed = new URL(candidate);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

export function canonicalKey(
  url: string,
  source?: string,
  sourceId?: string
): string {
  if (url) {
    const host = extractHost(url);
    if (host && !DISCUSSION_HOSTS.has(host)) return host;
  }

  if (sourceId && source) {
    return `${source}:${sourceId}`;
  }

  if (url) {
    try {
      const parsed = new URL(
        /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) ? url : `https://${url}`
      );
      const path = parsed.pathname.replace(/^\/|\/$/g, "");
      if (path) return `${source ?? "unknown"}:${path}`;
    } catch {
      // fall through
    }
  }

  throw new Error(
    `Cannot build canonical key: url=${url} source=${source} sourceId=${sourceId}`
  );
}