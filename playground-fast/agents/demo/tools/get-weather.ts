/**
 * get-weather (FAST playground) — the demo agent's only tool. Deterministic
 * (no external API call): always returns a sunny 21C reading for the
 * requested city, rendered server-side into a `<demo-weather-card>` DSD
 * fragment via ui(). Mirrors playground/agents/demo/tools/get-weather.ts
 * (Lit), but FAST's `ui()` renderer takes a TEMPLATE STRING with plain HTML
 * attributes, not a lit-html property-binding template — proof that the
 * UIResult contract is not secretly Lit-shaped (RFC vertical-slice item 4).
 */
import { defineTool, type StandardSchemaV1 } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
// Registers <demo-weather-card> (FASTElement.define() side effect) so
// @microsoft/fast-ssr can find and SSR its shadow root. A bare
// `import '...demo-weather-card.js'` has no used binding, and Nitro's
// rollup build only allowlists its own runtime dir in `moduleSideEffects`
// (everything else defaults to tree-shakeable) — a side-effect-only import
// here gets silently dropped from the bundle, `.define()` never runs, and
// the ui() call below renders an opaque, childless <demo-weather-card> tag
// instead of DSD. Referencing the export keeps Rollup from removing the
// module (see the Lit sibling, playground/agents/demo/tools/get-weather.ts,
// for the identical pattern).
//
// demo-weather-card.ts itself installs the FAST DOM shim + fastSSR() patch
// as ITS OWN first imports, ahead of its own `@microsoft/fast-element`
// import — see that file's header comment for why that has to live there
// rather than here: Nitro's dev bundler (Rolldown) does not reliably honor
// import declaration order for `@microsoft/fast-ssr` vs `@microsoft/fast-
// element` ACROSS file boundaries in this app's bundle (confirmed by
// bisecting against this app's baseline and inspecting `.nitro/dev/
// index.mjs` directly — a shim import declared first in THIS file still
// landed after `@microsoft/fast-element`'s hoisted import in the compiled
// output), but it DOES honor it within a single file's own import list.
import { DemoWeatherCard } from '../../../components/demo-weather-card.js';
void DemoWeatherCard;

interface GetWeatherInput {
  city: string;
}

// Hand-rolled Standard Schema (same pattern as the Lit playground's tool).
const getWeatherSchema: StandardSchemaV1<unknown, GetWeatherInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground-fast',
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
    return ui(`<demo-weather-card city="${city}" temp-c="${tempC}" summary="${summary}"></demo-weather-card>`, {
      data: { city, tempC, summary },
    });
  },
});
