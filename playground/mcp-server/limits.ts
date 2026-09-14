/**
 * The limits of the playground MCP server: what reaches a model, and how big a
 * cache keyed by user input may grow.
 *
 * Kept apart from `index.ts` because that file starts a server the moment it is
 * imported — it reads the manifest, exits without one, and binds a transport.
 * Nothing here has a side effect, so a test can import it and pin the numbers.
 */

/**
 * Both caches are keyed by TEXT THE CALLER SUPPLIED, and the explorer hands
 * that key to anyone who can type. Without a bound, N distinct strings means N
 * entries held forever. The number is small on purpose: this is a demo rig, and
 * an unbounded map keyed by user input is the pattern people copy.
 */
export const MAX_ENTRIES = 200;

/**
 * The longest city name this rig will accept, and the longest it will echo.
 *
 * A tool result is read by the MODEL. The explorer gives the view an input box,
 * so whatever is typed inside the iframe travels to the server and comes back
 * in `content[0].text` — which means a person can put arbitrary text into a
 * model's context through a weather card. Capping it does not make that safe;
 * it bounds it, and a bound is the part a demo should show. The real defence
 * is that a model must not treat tool output as instructions.
 *
 * 80 is longer than any real place name (the longest is 85 characters and is a
 * hill in New Zealand, which Open-Meteo does not index).
 */
export const MAX_CITY = 80;

/**
 * String.prototype.toWellFormed(), spelled so it type-checks. That method lives
 * in lib.es2024 and this repo targets ES2022, so calling it directly is a type
 * error that only runtime — Node 24 — lets through.
 *
 * Replaces a lone surrogate, half of a pair with no partner, with U+FFFD. That
 * is exactly what toWellFormed() does; the verification compared the two.
 */
export function wellFormed(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
}

/**
 * Caps what we echo at MAX_CITY characters, the ellipsis INCLUDED — so the cap
 * is the number stated, not one more.
 *
 * Counts CODE POINTS, not UTF-16 units. Slicing units cut an emoji in half and
 * left a lone surrogate; encodeURIComponent threw on it, and the catch in
 * forecast() then told the model the network was down while it was not.
 * wellFormed() also repairs a lone surrogate already present in the input,
 * which capping alone would pass straight through.
 *
 * A grapheme built from several code points — a flag, a ZWJ family — can still
 * be cut between them. That breaks a glyph, not the request: it cannot throw.
 */
export function capped(text: string): string {
  const safe = wellFormed(text);
  const chars = Array.from(safe);
  return chars.length <= MAX_CITY ? safe : `${chars.slice(0, MAX_CITY - 1).join('')}…`;
}

/**
 * Inserts, then enforces the bound — in that order.
 *
 * Evicting only BEFORE an insert let the map settle at 201, and let N
 * concurrent misses each sweep an under-cap map before any of them inserted:
 * 50 at once on a full cache left 250. Trimming after every set holds the bound
 * whatever is in flight.
 *
 * The delete-then-set matters too. Map keeps a key's ORIGINAL insertion
 * position on update, so a refreshed entry would otherwise stay "oldest" and be
 * the first thing evicted.
 */
export function remember<V extends { at: number }>(
  cache: Map<string, V>,
  key: string,
  value: V,
  ttlMs: number,
): void {
  cache.delete(key);
  cache.set(key, value);
  evict(cache, ttlMs);
}

/**
 * Drops what has expired, then the oldest entries until the map fits.
 *
 * A TTL checked only on READ frees nothing — the entry stays in the map, which
 * is what the old `wxCache` did. Map iterates in insertion order, so the first
 * keys are the oldest.
 */
export function evict(cache: Map<string, { at: number }>, ttlMs: number): void {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.at >= ttlMs) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}
