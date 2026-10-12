/**
 * Canonical key parity test — TypeScript side.
 * Output format must match tests/test_canonical_parity.py.
 */

import { canonicalKey } from "../lib/utils/canonical-key";

type Case = {
  url: string | null;
  source: string;
  sourceId: string | null;
};

const CASES: Case[] = [
  { url: "https://acme.io/pricing?utm=x", source: "hackernews", sourceId: null },
  { url: "http://www.acme.io/", source: "rss", sourceId: null },
  { url: "https://ACME.io", source: "reddit_r/startups", sourceId: null },
  { url: "https://blog.example.com/post/1", source: "rss", sourceId: null },
  { url: "acme.io", source: "rss", sourceId: null },
  { url: "https://news.ycombinator.com/item?id=12345", source: "hackernews", sourceId: "12345" },
  { url: null, source: "reddit_r/startups", sourceId: "abc123" },
  { url: "https://www.example.co.uk/product/42", source: "rss", sourceId: null },
];

const results = CASES.map((c) => {
  try {
    const key = canonicalKey(
      c.url ?? "",
      c.source,
      c.sourceId ?? undefined
    );
    return { input: c, key, error: null };
  } catch (e) {
    return {
      input: c,
      key: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

console.log("CANONICAL_PARITY_JSON_START");
console.log(JSON.stringify(results, Object.keys(results[0]).sort(), 2));
console.log("CANONICAL_PARITY_JSON_END");