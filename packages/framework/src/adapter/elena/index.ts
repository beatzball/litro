/**
 * adapter/elena/index.ts — Elena framework adapter
 *
 * Implements FrameworkAdapter for Elena (elenajs.com).
 *
 * SSR: Direct rendering — instantiate component, call render(), stringify.
 *      No @elenajs/ssr dependency required. Elena's html tag produces a
 *      TemplateResult with a .toString() method that handles escaping.
 * Hydration: None — Elena uses progressive enhancement (components upgrade in place)
 * Styles: Light DOM with @scope CSS encapsulation
 *
 * Key difference from Lit/FAST: Elena's SSR output is plain HTML without
 * Declarative Shadow DOM wrappers. This means:
 *   - No DSD polyfill needed in <head>
 *   - No <template shadowrootmode="open"> in output
 *   - Global CSS reaches component internals
 *   - Smaller HTML payloads, no DSD parsing cost
 */

import type { FrameworkAdapter } from '../types.js';

/**
 * Install simplified prop getters on a component prototype so that
 * render() can read prop values from the internal _props Map.
 * Same technique as @elenajs/ssr's installPropGetters.
 */
const _initialized = new WeakSet<Function>();

function installPropGetters(ComponentClass: any): void {
  if (_initialized.has(ComponentClass)) return;
  _initialized.add(ComponentClass);

  const props = ComponentClass.props;
  if (!props) return;

  for (const p of props) {
    const name = typeof p === 'string' ? p : p.name;
    const descriptor = Object.getOwnPropertyDescriptor(ComponentClass.prototype, name);
    if (descriptor && typeof descriptor.get === 'function') continue;

    Object.defineProperty(ComponentClass.prototype, name, {
      configurable: true,
      enumerable: true,
      get() { return this._props ? this._props.get(name) : undefined; },
      set(value: unknown) {
        if (!this._props) this._props = new Map();
        this._props.set(name, value);
      },
    });
  }
}

/**
 * Normalize whitespace to match Elena's client-side rendering output.
 */
function normalizeWhitespace(markup: string): string {
  return markup
    .replace(/>\n\s*/g, '>')
    .replace(/\n\s*</g, '<')
    .replace(/\n\s*/g, ' ')
    .replace(/>\s+</g, '><');
}

/**
 * Render a single Elena component class to an HTML string.
 * Creates an instance, sets props, calls willUpdate() + render(),
 * and stringifies the TemplateResult.
 *
 * @param children - Pre-rendered innerHTML from the parent's template.
 *   Set as instance.innerHTML so components using this.innerHTML (e.g.
 *   wrapper components like litro-card-grid) can access child content.
 */
function renderComponent(
  ComponentClass: any,
  attrs: Record<string, string>,
  serverData?: unknown,
  children?: string,
): string {
  installPropGetters(ComponentClass);

  const instance = new ComponentClass();

  // Capture default value types for attribute conversion.
  const propDefaultTypes: Record<string, string> = {};
  for (const p of ComponentClass.props || []) {
    const name = typeof p === 'string' ? p : p.name;
    const value = instance[name];
    propDefaultTypes[name] = typeof value;

    if (Object.prototype.hasOwnProperty.call(instance, name)) {
      delete instance[name];
      if (!instance._props) instance._props = new Map();
      instance._props.set(name, value);
    }
  }

  // Apply HTML attributes as props, converting types based on defaults.
  if (!instance._props) instance._props = new Map();
  for (const [key, value] of Object.entries(attrs)) {
    const type = propDefaultTypes[key];
    if (type === 'boolean') {
      instance._props.set(key, value !== null && value !== 'false');
    } else if (type === 'number') {
      instance._props.set(key, value === null ? null : +value);
    } else if (type === 'object') {
      // Arrays and objects are JSON-serialized in attributes.
      if (!value) { instance._props.set(key, null); }
      else { try { instance._props.set(key, JSON.parse(value)); } catch { instance._props.set(key, null); } }
    } else {
      instance._props.set(key, value === '' ? true : value);
    }
    // Also set _text for Elena's built-in text property.
    if (key === 'text') instance._text = value;
  }

  // Inject serverData directly (bypasses attribute conversion).
  if (serverData !== undefined) {
    instance._props.set('serverData', serverData);
  }

  // Set innerHTML for wrapper components that read this.innerHTML.
  if (children !== undefined) {
    instance.innerHTML = children;
  }

  try {
    instance.willUpdate?.();
    const result = instance.render();
    if (!result) return '';
    return normalizeWhitespace(result.toString());
  } catch (error: any) {
    const tag = ComponentClass.tagName ?? 'unknown';
    console.warn(`[litro:elena] SSR render failed for <${tag}>: ${error.message}`);
    return '';
  }
}

/** Decode HTML entities that Elena's html tag escapes in attribute values. */
const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
};
function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m] || m);
}

/** Regex to find custom element tags (tags containing a hyphen). */
const CE_TAG_RE = /<([a-z][a-z0-9]*-[a-z0-9-]*)([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/gi;

/** Parse attributes from an HTML attribute string, decoding HTML entities. */
function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-z][a-z0-9-]*)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/gi;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? '');
  }
  return attrs;
}

/**
 * Recursively expand custom element tags in an HTML string.
 * Looks up each CE tag in the component registry and renders it.
 *
 * Expansion is bottom-up: children are expanded first, then passed
 * to the parent as innerHTML. This allows wrapper components (like
 * litro-card-grid) to access pre-rendered child content.
 */
function expandNestedCEs(html: string, ceMap: Map<string, Function>, depth = 0): string {
  if (depth > 10) return html; // Guard against infinite recursion.
  return html.replace(CE_TAG_RE, (match, tag, attrStr, childContent) => {
    // Skip already-expanded CEs (have hydrated attribute from a prior pass).
    if (attrStr && /\bhydrated\b/.test(attrStr)) return match;
    const ComponentClass = ceMap.get(tag);
    if (!ComponentClass) return match; // Not registered — leave as-is.
    // First expand any nested CEs in the children (bottom-up).
    const expandedChildren = childContent
      ? expandNestedCEs(childContent, ceMap, depth + 1)
      : undefined;
    const attrs = parseAttrs(attrStr || '');
    const innerHTML = renderComponent(ComponentClass, attrs, undefined, expandedChildren);
    if (!innerHTML) return match;
    // Then expand any nested CEs in this component's rendered output.
    const expanded = expandNestedCEs(innerHTML, ceMap, depth + 1);
    return `<${tag}${attrStr || ''} hydrated>${expanded}</${tag}>`;
  });
}

/**
 * Render an Elena component to an AsyncIterable<string>.
 *
 * Direct rendering: instantiate the component class, call render(),
 * and stringify the TemplateResult. No @elenajs/ssr dependency needed.
 *
 * serverData is injected directly into the instance's _props Map.
 * Nested custom elements are recursively expanded using the
 * customElements shim registry.
 */
async function* renderElenaPage(
  tag: string,
  serverData: unknown,
): AsyncIterable<string> {
  const ceMap: Map<string, Function> | undefined = (globalThis as any).__litro_elena_ce_map__;
  if (!ceMap) {
    throw new Error(
      '[litro:elena] Component registry not found. ' +
        'Ensure LITRO_ADAPTER=elena is set and the manifest preamble ran.',
    );
  }

  const ComponentClass = ceMap.get(tag);
  if (!ComponentClass) {
    throw new Error(
      `[litro:elena] Component <${tag}> not found in registry. ` +
        `Registered: ${[...ceMap.keys()].join(', ')}`,
    );
  }

  const innerHTML = renderComponent(ComponentClass, {}, serverData);
  // Expand any nested custom elements in the render output.
  const expanded = expandNestedCEs(innerHTML, ceMap);
  yield `<${tag} hydrated>${expanded}</${tag}>`;
}

export const elenaAdapter: FrameworkAdapter = {
  name: 'elena',

  renderPage(tag: string, serverData: unknown): AsyncIterable<string> {
    return renderElenaPage(tag, serverData);
  },

  getHeadScripts(_options: { isDev: boolean; basePath: string }): string {
    // Elena uses progressive enhancement — no hydration script needed.
    return '';
  },

  needsDSDPolyfill: false,

  clientEntryModule: '../adapter/elena/runtime/client.js',

  vitePlugins() {
    return [];
  },

  nitroConfig() {
    // Elena has no special bundling requirements.
    // @elenajs/core is tiny (2.9kB) and has no Node-specific issues.
    // No decorator config needed — Elena uses static props, not decorators.
    return {};
  },

  manifestPreamble() {
    // Import the SSR shim FIRST — it provides HTMLElement and customElements
    // globals for Node.js. ESM evaluates imports in declaration order, so
    // this runs before page module imports (which extend HTMLElement and
    // call customElements.define()).
    //
    // The shim's customElements.define() captures every component class
    // into __litro_elena_ce_map__. renderElenaPage() reads this map to
    // instantiate components directly — no @elenajs/ssr needed.
    //
    // Uses `import * as` to prevent Rollup tree-shaking of the side-effect
    // import (Rollup drops bare `import` of external packages without
    // "sideEffects" in package.json).
    return [
      `import * as _elenaShim from '@beatzball/litro/adapter/elena/ssr-shim';`,
      `globalThis.__litro_elena_shim__ = _elenaShim;`,
      `process.env.LITRO_ADAPTER = 'elena';`,
    ].join('\n');
  },

  manifestPostamble(_pageModuleVars: string[]) {
    // No registration needed — renderElenaPage() reads directly from
    // the customElements shim map (__litro_elena_ce_map__) which is
    // populated by .define() calls during page module imports.
    return '';
  },
};
