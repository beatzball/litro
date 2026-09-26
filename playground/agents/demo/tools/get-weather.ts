/**
 * get-weather — the demo agent's only tool. Deterministic (no external API
 * call): always returns a sunny 21C reading for the requested city, rendered
 * server-side into a `<demo-weather-card>` DSD fragment via ui().
 */
import { html } from 'lit';
import { z } from 'zod';
import { defineTool } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
// Registers <demo-weather-card> (@customElement side effect) so @lit-labs/ssr
// can find and SSR its shadow root. A bare `import '...demo-weather-card.js'`
// has no used binding, and Nitro's rollup build only allowlists its own
// runtime dir in `moduleSideEffects` (everything else defaults to
// tree-shakeable) — a side-effect-only import here gets silently dropped
// from the bundle, `customElements.define()` never runs, and the ui() call
// below renders an opaque, childless <demo-weather-card> tag instead of DSD.
// Referencing the export keeps Rollup from removing the module.
import { DemoWeatherCard } from '../../../components/demo-weather-card.js';
void DemoWeatherCard;

/**
 * Zod 4, for its Standard JSON Schema converter.
 *
 * `toolInputJSONSchema()` reads `~standard.jsonSchema.input`, the converter
 * half of the Standard JSON Schema interface. A hand-rolled `~standard` object
 * can implement `validate` but not that, so it publishes the permissive
 * `{ type: 'object' }` — which tells a model and an MCP host nothing about the
 * arguments. With a converter, `tools/list` carries a typed, described,
 * required `city` instead.
 *
 * `.describe()` becomes the property's `description`, and `.max(80)` a
 * `maxLength`: both reach the host, so the schema itself now carries the
 * contract the description string used to spell out by hand.
 *
 * zod is a `playground` dependency only. `@beatzball/litro-agent` takes no
 * schema library — any Standard Schema vendor works, and a project that does
 * not need JSON Schema still needs no dependency at all.
 */
const getWeatherSchema = z.object({
  city: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe('The city name, e.g. "Lisbon".'),
});

export default defineTool({
  description: 'Get the current weather for a city.',
  input: getWeatherSchema,
  // The packed ui:// document an MCP host renders this tool's result in, named
  // by its `dist/mcp-apps/manifest.json` entry. `litro mcp serve` resolves it to
  // `ui://playground/weather-card` and publishes it as `_meta.ui.resourceUri`;
  // an unresolvable name fails at startup, because the MCP Apps spec requires
  // the resource to exist on the server. The chat loop ignores the field.
  app: 'weather-card',
  async execute({ city }) {
    const tempC = 21;
    const summary = 'sunny';
    return ui(html`<demo-weather-card .city=${city} .tempC=${tempC} .summary=${summary}></demo-weather-card>`, {
      data: { city, tempC, summary },
    });
  },
});
