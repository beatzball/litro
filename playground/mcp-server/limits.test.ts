/**
 * Pins the limits three reviews verified by hand. Each test names the bug it
 * would have caught.
 *
 * node:test, not vitest: the server runs on Node's own type stripping with no
 * build step, and its tests run the same way.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_CITY, MAX_ENTRIES, capped, evict, remember, wellFormed } from './limits.ts';

const HOUR = 60 * 60 * 1000;

/** Code points, which is what the cap counts. `.length` counts UTF-16 units. */
const points = (text: string) => Array.from(text).length;

/** True when no surrogate is left without its partner. */
const isWellFormed = (text: string) => wellFormed(text) === text;

describe('capped', () => {
  it('passes a name at the cap through untouched', () => {
    const name = 'a'.repeat(MAX_CITY);
    assert.equal(capped(name), name);
  });

  it('caps at exactly 80 code points, the ellipsis included', () => {
    // Was 81: MAX_CITY characters, THEN an ellipsis.
    const out = capped('a'.repeat(MAX_CITY + 20));
    assert.equal(MAX_CITY, 80);
    assert.equal(points(out), 80);
    assert.ok(out.endsWith('…'));
  });

  it('does not cut an emoji in half at the cap boundary', () => {
    // An emoji is two UTF-16 units. Slicing units at the boundary left a lone
    // surrogate, encodeURIComponent threw, and the server told the model the
    // network was down.
    // 79 units of 'a', so a unit slice at 80 keeps the emoji's first half only.
    const out = capped(`${'a'.repeat(MAX_CITY - 1)}🌧🌧`);
    assert.equal(points(out), 80);
    assert.ok(isWellFormed(out));
    assert.doesNotThrow(() => encodeURIComponent(out));
  });

  it('counts an emoji as one character, not two', () => {
    const name = '🌧'.repeat(MAX_CITY);
    assert.equal(capped(name), name);
  });

  it('repairs a lone surrogate already in the input', () => {
    // Capping alone passes a short input straight through, surrogate and all.
    const out = capped('Lon\uD800don');
    assert.equal(out, 'Lon�don');
    assert.doesNotThrow(() => encodeURIComponent(out));
  });
});

describe('wellFormed', () => {
  it('replaces a lone high or low surrogate with U+FFFD', () => {
    assert.equal(wellFormed('a\uD800b'), 'a�b');
    assert.equal(wellFormed('a\uDC00b'), 'a�b');
    assert.equal(wellFormed('\uDC00\uD800'), '��');
  });

  it('leaves a surrogate pair alone', () => {
    assert.equal(wellFormed('🌧'), '🌧');
  });

  it('matches String.prototype.toWellFormed where the runtime has it', (t) => {
    // Reached through a cast: the method is lib.es2024 and this repo targets
    // ES2022, which is the reason wellFormed() exists.
    const native = (String.prototype as { toWellFormed?: (this: string) => string }).toWellFormed;
    if (!native) return t.skip('runtime has no toWellFormed');
    for (const sample of ['', 'plain', '🌧', 'a\uD800', '\uDC00a', '\uD800𐀀', '􏿿\uDC00']) {
      assert.equal(wellFormed(sample), native.call(sample), JSON.stringify(sample));
    }
  });
});

describe('remember', () => {
  it('never lets the cache pass its bound, even by one', () => {
    // Evicting only before an insert let the map settle at 201.
    const cache = new Map<string, { at: number }>();
    for (let i = 0; i < MAX_ENTRIES * 2; i += 1) {
      remember(cache, `city-${i}`, { at: Date.now() }, HOUR);
      assert.ok(cache.size <= MAX_ENTRIES, `size ${cache.size} after insert ${i}`);
    }
    assert.equal(cache.size, MAX_ENTRIES);
  });

  it('holds the bound under concurrent inserts on a full cache', async () => {
    // The old shape: evict, await the network, then set. Fifty misses at once
    // each swept an under-cap map before any of them inserted, leaving 250.
    const cache = new Map<string, { at: number }>();
    for (let i = 0; i < MAX_ENTRIES; i += 1) remember(cache, `old-${i}`, { at: Date.now() }, HOUR);

    let largest = cache.size;
    await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        evict(cache, HOUR);
        await new Promise((r) => setTimeout(r, 1));
        remember(cache, `new-${i}`, { at: Date.now() }, HOUR);
        largest = Math.max(largest, cache.size);
      }),
    );

    assert.equal(largest, MAX_ENTRIES);
    assert.equal(cache.size, MAX_ENTRIES);
  });

  it('does not evict a refreshed key as the oldest', () => {
    // Map keeps a key's original position on update, so without delete-then-set
    // the entry just refreshed would be the first one dropped.
    const cache = new Map<string, { at: number }>();
    for (let i = 0; i < MAX_ENTRIES; i += 1) remember(cache, `city-${i}`, { at: Date.now() }, HOUR);

    remember(cache, 'city-0', { at: Date.now() }, HOUR);
    remember(cache, 'one-more', { at: Date.now() }, HOUR);

    assert.ok(cache.has('city-0'), 'refreshed key was evicted');
    assert.ok(!cache.has('city-1'), 'the actual oldest key survived');
    assert.equal(cache.size, MAX_ENTRIES);
  });
});

describe('evict', () => {
  it('frees an expired entry instead of leaving it for a read to skip', () => {
    const cache = new Map<string, { at: number }>([
      ['stale', { at: Date.now() - HOUR }],
      ['fresh', { at: Date.now() }],
    ]);
    evict(cache, HOUR);
    assert.deepEqual([...cache.keys()], ['fresh']);
  });
});
