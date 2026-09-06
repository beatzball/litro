/**
 * A read-only MCP App: the demo weather card, packed as a `ui://` resource.
 *
 * Run `pnpm --filter playground mcp-app` to pack it.
 *
 * WHY `apply` REACHES INTO THE SHADOW ROOT
 *
 * No component runtime is inlined into this document, so the Declarative
 * Shadow DOM the server rendered is static markup — assigning `.city` on the
 * element would set a property nothing is watching, and the card would never
 * change. Writing the text directly is what actually updates the view, and it
 * needs no framework at all.
 *
 * That is the trade this document makes on purpose: it is 4 KB with no
 * download and it paints immediately, in exchange for a fill step written by
 * hand. Inlining the Lit runtime instead is a `runtime:` away, and costs the
 * runtime's bytes in every copy of every app.
 */
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';
import { html } from 'lit';
import { DemoWeatherCard } from '../components/demo-weather-card.js';

void DemoWeatherCard; // named import + void: bare side-effect imports get tree-shaken

export default defineMcpApp({
  // No `uri`: the packer derives it. The package name is the authority and
  // the file path is the path, so this packs as `ui://playground/weather-card`.
  title: 'Weather',

  // Rendered with no data: a host caches this template and reuses it for every
  // call of the tool that points at it.
  shell: html`<demo-weather-card city="—" summary="Waiting for the forecast…"></demo-weather-card>`,

  styles: 'body { margin: 0; padding: 8px; background: transparent; }',

  apply: `function (el, data) {
    var root = el.shadowRoot;
    if (!root) return;
    var set = function (sel, text) {
      var node = root.querySelector(sel);
      if (node) node.textContent = text;
    };
    if (data.city !== undefined) set('.city', String(data.city));
    if (data.tempC !== undefined) set('.temp', data.tempC + '\\u00B0C');
    if (data.summary !== undefined) set('.summary', String(data.summary));
  }`,

  // No `csp` at all, on purpose. The spec has the sandbox "apply restrictive
  // defaults if no CSP metadata is provided", which is tighter than handing it
  // an empty object to build a policy from. This view reaches nothing.
  prefersBorder: true,
});
