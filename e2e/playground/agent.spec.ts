import { test, expect } from '@playwright/test';
import { serializeValue, createStreamDecoder, type StreamChunk } from '../../packages/framework/dist/stream.js';

/**
 * Decodes a raw `/__litro/agent/:agent/:session` NDJSON response body into
 * `StreamChunk`s. The wire format is seroval cross-JSON (`{"n": <node>}` per
 * line, `{"done":true}` terminal) -- a plain object's `kind` field does NOT
 * survive as a literal `"kind":"ui"` substring in the raw text (verified: a
 * `{ kind: 'ui', ... }` payload encodes as `{"t":1,"s":"ui"}` inside the
 * cross-JSON node), so raw-substring assertions on event kind would be
 * false-negative-prone. Always go through the real decoder, exactly like
 * `packages/litro-agent/src/runtime/handler.test.ts` and the browser client
 * (`@beatzball/litro-agent/client`) do.
 */
function decodeLines(text: string): StreamChunk[] {
  const decode = createStreamDecoder();
  return text
    .split('\n')
    .filter((l) => l.length > 0)
    .map(decode);
}

function valueKinds(chunks: StreamChunk[]): string[] {
  return chunks
    .filter((c): c is { kind: 'value'; value: unknown } => c.kind === 'value')
    .map((c) => (c.value as { kind: string }).kind);
}

test.describe('agent demo — chat, data/UI separation (Lit playground, /agent)', () => {
  test('weather chat: narration, tool-call UI card, and the closing text all arrive in one turn', async ({
    page,
  }) => {
    await page.goto('/agent');
    // The router's initial resolve mounts a second (hidden) page-agent
    // alongside the SSR'd one before the atomic swap settles (see
    // LitroOutlet.ts / litro-router's _resolve()); wait for it before
    // interacting, exactly as server-actions-forms.spec.ts and
    // server-actions-streaming.spec.ts do for page-forms.
    await page.waitForSelector('page-agent:not([hidden])');

    await page.fill('#chat-input', 'what is the weather in lisbon');
    await page.click('#chat-send');

    await expect(page.locator('#chat-log')).toContainText('Checking the weather');

    // The `ui` event's DSD markup is injected via hydrateUIResult()'s
    // setHTMLUnsafe() -- a native declarative shadow root attaches (and its
    // inline <style>/content render) independent of whether the
    // demo-weather-card class has been registered client-side, so the card
    // is visible and its shadow text is queryable without any JS upgrade.
    const card = page.locator('#ui-slot demo-weather-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Lisbon');
    await expect(card).toContainText('21');

    // v0: the tool result feeds back within the SAME POST turn (no second
    // client-triggered round) -- the closing narration ("...weather card.")
    // arrives in the same stream as the tool-call/ui events above.
    await expect(page.locator('#chat-log')).toContainText('weather card.');
  });

  test('the data channel (#fallback-data) carries the UI result data cleanly, with no HTML/shadow markup', async ({
    page,
  }) => {
    await page.goto('/agent');
    await page.waitForSelector('page-agent:not([hidden])');

    await page.fill('#chat-input', 'what is the weather in lisbon');
    await page.click('#chat-send');

    await expect(page.locator('#fallback-data')).toContainText('"tempC":21');

    const fallback = await page.locator('#fallback-data').textContent();
    expect(fallback).toBeTruthy();
    // The `ui` event's `data` field (fed to #fallback-data via
    // JSON.stringify) must never carry the `html` half of the UIResult --
    // that's the data/UI separation item-2 contract.
    expect(fallback!.toLowerCase()).not.toContain('shadowroot');
    expect(fallback!.toLowerCase()).not.toContain('<demo-weather-card');
  });
});

test.describe('agent demo — raw NDJSON transport', () => {
  test('POST requires x-litro-agent; a valid POST streams a ui event and terminates {"done":true}; GET replays identically', async ({
    request,
  }) => {
    // Unique per run: the session log is an append-only file, so a fixed id
    // would accumulate turns across repeated local runs and break the
    // GET-replays-identically assertion (GET ?from=0 would replay every past
    // turn, not just this one).
    const session = `e2e-raw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    // Gate: POST without the custom header is rejected before any turn runs.
    const missingHeader = await request.post(`/__litro/agent/demo/${session}`, {
      headers: { 'content-type': 'application/json' },
      data: serializeValue({ text: 'weather now' }),
    });
    expect(missingHeader.status()).toBe(403);

    const postRes = await request.post(`/__litro/agent/demo/${session}`, {
      headers: { 'content-type': 'application/json', 'x-litro-agent': '1' },
      data: serializeValue({ text: 'weather now' }),
    });
    expect(postRes.status()).toBe(200);
    expect(postRes.headers()['content-type']).toContain('application/x-ndjson');

    const postChunks = decodeLines(await postRes.text());
    expect(postChunks[postChunks.length - 1]).toEqual({ kind: 'done' });
    const postKinds = valueKinds(postChunks);
    expect(postKinds).toContain('ui');
    expect(postKinds).toContain('tool-call');
    expect(postKinds[postKinds.length - 1]).toBe('turn-end');

    // GET replay reproduces the identical persisted event-kind sequence,
    // including the `ui` event, and also terminates cleanly.
    const getRes = await request.get(`/__litro/agent/demo/${session}?from=0`);
    expect(getRes.status()).toBe(200);
    const getChunks = decodeLines(await getRes.text());
    expect(getChunks[getChunks.length - 1]).toEqual({ kind: 'done' });
    expect(valueKinds(getChunks)).toEqual(postKinds);
  });
});
