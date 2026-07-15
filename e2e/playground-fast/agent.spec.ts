import { test, expect } from '@playwright/test';

/**
 * agent demo — FAST playground (/agent)
 *
 * Item-1 subset from the Lit playground's e2e/playground/agent.spec.ts (send
 * a weather message, text streams into #chat-log, #ui-slot shows a
 * demo-weather-card with real DSD content) + item-2 (the #fallback-data
 * data channel stays clean of HTML/shadow markup). No resume spec here (that
 * lives only in e2e/playground/agent-resume.spec.ts, per the Task 16 brief).
 *
 * The whole point of this spec existing on the FAST playground: the exact
 * same client contract (element ids, event kinds, hydrateUIResult) that
 * passes against the Lit playground's Lit-rendered UIResult also passes here
 * against a UIResult produced by @microsoft/fast-ssr's templateRenderer — a
 * plain HTML attribute string in, DSD out, not a lit-html TemplateResult.
 * That's the proof the UIResult contract isn't secretly Lit-shaped (RFC
 * vertical-slice item 4).
 */
test.describe('agent demo — chat, data/UI separation (FAST playground, /agent)', () => {
  test('weather chat: narration, tool-call UI card, and the closing text all arrive in one turn', async ({
    page,
  }) => {
    await page.goto('/agent');
    // Same router double-mount caveat as the Lit playground's spec: the
    // router's initial resolve mounts a second (hidden) page-agent alongside
    // the SSR'd one before the atomic swap settles.
    await page.waitForSelector('page-agent:not([hidden])');

    await page.fill('#chat-input', 'what is the weather in lisbon');
    await page.click('#chat-send');

    await expect(page.locator('#chat-log')).toContainText('Checking the weather');

    // hydrateUIResult()'s setHTMLUnsafe() attaches a native declarative
    // shadow root independent of whether demo-weather-card has been
    // registered client-side, so the card is visible and its shadow text is
    // queryable without any JS upgrade.
    const card = page.locator('#ui-slot demo-weather-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Lisbon');
    await expect(card).toContainText('21');

    // v0: the tool result feeds back within the SAME POST turn (no second
    // client-triggered round) -- the closing narration arrives in the same
    // stream as the tool-call/ui events above.
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
    // the data/UI separation item-2 contract. `not.toContain('shadowroot')`
    // is the FAST-specific proof: FAST's DSD attribute is literally
    // `shadowroot`/`shadowrootmode` in the html half, so this assertion
    // fails loudly if data/html ever got merged for this renderer too.
    expect(fallback!.toLowerCase()).not.toContain('shadowroot');
    expect(fallback!.toLowerCase()).not.toContain('<demo-weather-card');
  });
});
