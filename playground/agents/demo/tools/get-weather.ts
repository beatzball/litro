/**
 * get-weather — the demo agent's only tool. Deterministic (no external API
 * call): always returns a sunny 21C reading for the requested city, rendered
 * server-side into a `<demo-weather-card>` DSD fragment via ui().
 */
import { html } from 'lit';
import { defineTool, type StandardSchemaV1 } from '@beatzball/litro-agent';
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

interface GetWeatherInput {
  city: string;
}

// Hand-rolled Standard Schema (same pattern as playground/actions/forms.server.ts).
const getWeatherSchema: StandardSchemaV1<unknown, GetWeatherInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      if (typeof v.city !== 'string' || v.city.trim() === '') {
        return { issues: [{ message: 'city is required' }] };
      }
      return { value: { city: v.city.trim() } };
    },
  },
};

export default defineTool({
  // Name the argument in the description: v0 hands the provider a permissive
  // object schema, so the description carries the parameter contract. This
  // makes tool-capable models (incl. smaller local ones) call it reliably.
  description: 'Get the current weather for a city. Argument: { city: string } — the city name, e.g. "Lisbon".',
  input: getWeatherSchema,
  async execute({ city }) {
    const tempC = 21;
    const summary = 'sunny';
    return ui(html`<demo-weather-card .city=${city} .tempC=${tempC} .summary=${summary}></demo-weather-card>`, {
      data: { city, tempC, summary },
    });
  },
});
