/**
 * Shared styles for /compare/* and /why-web-components pages.
 *
 * These styles are injected into each comparison page component's shadow root
 * via `static override styles`. They provide:
 *   - Typography for headings, paragraphs, lists, tables
 *   - Two-column code comparison layout (.code-compare)
 *   - Feature comparison table with ✓ / — cell colouring
 *   - CTA section styling
 *   - Dark pre/code blocks (fire theme, no hljs — static content)
 */
import { css } from 'lit';

export const compareStyles = css`
  :host { display: block; }

  /* ── Page layout ────────────────────────────────────────────────── */
  .page { min-height: 100vh; display: flex; flex-direction: column; }
  main {
    flex: 1;
    max-width: 56rem;
    margin: 0 auto;
    padding: 3rem 1.5rem 5rem;
    width: 100%;
  }

  /* ── Typography ─────────────────────────────────────────────────── */
  h1 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 800;
    line-height: 1.15;
    margin: 0 0 1rem;
    color: var(--sl-color-text);
  }
  h2 {
    font-size: var(--sl-text-2xl, 1.5rem);
    font-weight: 700;
    margin: 2.5rem 0 0.75rem;
    padding-bottom: 0.25em;
    border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
    color: var(--sl-color-text);
  }
  h3 {
    font-size: var(--sl-text-xl, 1.25rem);
    font-weight: 600;
    margin: 1.75rem 0 0.5rem;
    color: var(--sl-color-text);
  }
  p { margin: 0 0 1rem; line-height: 1.7; color: var(--sl-color-text); }
  ul, ol { padding-left: 1.5rem; margin: 0 0 1rem; }
  li { margin-bottom: 0.4rem; line-height: 1.7; color: var(--sl-color-text); }
  a { color: var(--sl-color-accent, #ea580c); text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { font-weight: 600; }

  /* ── Intro paragraph ─────────────────────────────────────────────── */
  .intro {
    font-size: var(--sl-text-lg, 1.125rem);
    color: var(--sl-color-gray-5, #6b7280);
    margin-bottom: 2rem;
    line-height: 1.65;
  }

  /* ── Callout / highlight box ─────────────────────────────────────── */
  .callout {
    background: color-mix(in srgb, var(--sl-color-accent) 8%, transparent);
    border-left: 4px solid var(--sl-color-accent, #ea580c);
    border-radius: 0 0.5rem 0.5rem 0;
    padding: 1rem 1.25rem;
    margin: 1.5rem 0;
    font-size: var(--sl-text-base, 1rem);
  }
  .callout strong { color: var(--sl-color-accent, #ea580c); }

  /* ── Inline code ─────────────────────────────────────────────────── */
  code {
    font-family: var(--sl-font-mono, ui-monospace, monospace);
    font-size: 0.875em;
    background: var(--sl-color-bg-inline-code, #f1f5f9);
    border: 1px solid var(--sl-color-border, #e2e8f0);
    border-radius: 0.25rem;
    padding: 0.1em 0.4em;
  }

  /* ── Code blocks ─────────────────────────────────────────────────── */
  pre {
    background: #0d0e11;
    color: #e2e4e9;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    margin: 0;
    font-size: var(--sl-text-sm, 0.875rem);
    line-height: 1.6;
    font-family: var(--sl-font-mono, ui-monospace, monospace);
  }
  pre code { background: none; border: none; padding: 0; font-size: inherit; }

  /* ── Code pane labels ────────────────────────────────────────────── */
  .pane-label {
    font-size: var(--sl-text-xs, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sl-color-gray-4, #9ca3af);
    margin: 0 0 0.4rem;
  }

  /* ── Two-column code comparison ──────────────────────────────────── */
  .code-compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin: 1.25rem 0 1.5rem;
  }
  @media (max-width: 640px) {
    .code-compare { grid-template-columns: 1fr; }
  }

  /* ── Feature comparison table ────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
    margin: 1.25rem 0 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--sl-color-border, #e2e8f0);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sl-text-sm, 0.875rem);
  }
  th {
    background: var(--sl-color-gray-1, #f8fafc);
    font-weight: 600;
    text-align: left;
    padding: 0.6rem 1rem;
    border-bottom: 2px solid var(--sl-color-border, #e2e8f0);
    color: var(--sl-color-text);
  }
  td {
    padding: 0.55rem 1rem;
    border-bottom: 1px solid var(--sl-color-border, #e2e8f0);
    color: var(--sl-color-text);
    vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: var(--sl-color-gray-1, #f8fafc); }
  .check { color: #16a34a; font-weight: 700; }
  .dash { color: var(--sl-color-gray-4, #9ca3af); }
  .same { color: var(--sl-color-accent, #ea580c); font-size: 0.7em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── Sections ────────────────────────────────────────────────────── */
  .section { margin-bottom: 2.5rem; }

  /* ── CTA block ───────────────────────────────────────────────────── */
  .cta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--sl-color-border, #e2e8f0);
  }
`;
