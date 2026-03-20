import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '../../src/seo.js';
import { compareStyles } from '../../src/compare-styles.js';

// Register components used in render()
import '../../src/components/starlight-header.js';

export interface CompareEnhanceData {
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

export const pageData = definePageData(async (_event) => {
  const seoTitle = 'Litro vs Enhance: Two Approaches to SSR Web Components';
  const description = 'Compare Litro and Enhance.dev — the two main frameworks for server-rendering web components. Honest trade-offs, feature comparison, and guidance on when to choose each.';

  const seoHead = buildSeoHead({
    title: seoTitle,
    description,
    path: '/compare/enhance',
    type: 'article',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': seoTitle,
    'description': description,
    'url': 'https://litro.dev/compare/enhance',
    'about': [
      { '@type': 'SoftwareApplication', 'name': 'Litro', 'url': 'https://litro.dev' },
      { '@type': 'SoftwareApplication', 'name': 'Enhance', 'url': 'https://enhance.dev' },
    ],
  });

  return {
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies CompareEnhanceData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Litro vs Enhance',
};

@customElement('page-compare-enhance')
export class CompareEnhancePage extends LitroPage {
  static override styles = compareStyles;

  override render() {
    const data = this.serverData as CompareEnhanceData | null;
    const siteTitle = data?.siteTitle ?? 'Litro';
    const nav = data?.nav ?? [];

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/compare/enhance"
        ></starlight-header>

        <main>
          <h1>Litro vs Enhance</h1>
          <p class="intro">
            Enhance (by Begin.dev) and Litro are the two main frameworks for server-rendering
            web components without React or Vue. They share the same fundamental goal and differ
            significantly in how they get there.
          </p>

          <!-- What they share -->
          <h2>What They Share</h2>
          <ul>
            <li>Server-first web components — HTML is rendered on the server before any JavaScript runs</li>
            <li>No React, Vue, or Svelte in the component model</li>
            <li>Progressive enhancement — pages work without JavaScript</li>
            <li>TypeScript support</li>
            <li>Standard Custom Elements at runtime</li>
          </ul>

          <!-- Feature comparison table -->
          <h2>Feature Comparison</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Enhance</th>
                  <th>Litro</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Component format</td><td>HTML-first SFCs</td><td>Lit class components</td></tr>
                <tr><td>Server rendering</td><td class="check">✓</td><td class="check">✓ Declarative Shadow DOM</td></tr>
                <tr><td>Client-side routing</td><td class="dash">— (MPA by default)</td><td class="check">✓ LitroRouter</td></tr>
                <tr><td>Server engine</td><td>Begin cloud / Arc</td><td>Nitro (Vercel, Cloudflare, AWS…)</td></tr>
                <tr><td>Deployment flexibility</td><td>Begin-centric</td><td>All Nitro presets</td></tr>
                <tr><td>JavaScript by default</td><td>Opt-in</td><td>Opt-in</td></tr>
                <tr><td>Lit ecosystem (Shoelace, etc.)</td><td class="dash">—</td><td class="check">✓</td></tr>
                <tr><td>TypeScript</td><td>Partial</td><td class="check">✓ Full</td></tr>
                <tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Key difference: component authoring -->
          <h2>Component Authoring</h2>
          <p>
            Enhance uses its own HTML-first Single File Component format. Components are pure
            functions that return HTML strings, with optional client-side enhancement via
            <code>&lt;script&gt;</code> tags. This is intentionally minimal — no library layer.
          </p>
          <p>
            Litro uses <a href="https://lit.dev" target="_blank" rel="noopener">Lit</a> — a 6 kB
            library that adds reactive properties, tagged template rendering, and lifecycle callbacks
            on top of the native Custom Elements API. Lit is widely adopted (used by Google, Adobe,
            and others) with its own ecosystem of components, tools, and community.
          </p>

          <div class="code-compare">
            <div>
              <p class="pane-label">Enhance — app/elements/my-counter.mjs</p>
              <pre><code>export default function MyCounter({
  html,
  state: { attrs }
}) {
  const count = attrs.count ?? 0;
  return html\`
    &lt;style&gt;
      button { padding: 0.5rem 1rem; }
    &lt;/style&gt;
    &lt;button&gt;Count: \${count}&lt;/button&gt;
    &lt;script type="module"&gt;
      // client enhancement here
    &lt;/script&gt;
  \`;
}</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — pages/index.ts (Lit component)</p>
              <pre><code>import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-counter')
class Counter extends LitElement {
  static styles = css\`
    button { padding: 0.5rem 1rem; }
  \`;

  static override properties = {
    _count: { state: true },
  };

  _count = 0;

  render() {
    return html\`
      &lt;button @click=\${() =&gt; this._count++}&gt;
        Count: \${this._count}
      &lt;/button&gt;
    \`;
  }
}</code></pre>
            </div>
          </div>

          <!-- Key difference: server and deployment -->
          <h2>Server and Deployment</h2>
          <p>
            Enhance is built for Begin's cloud platform and Arc (the AWS infrastructure-as-code
            tool Begin maintains). It works on AWS Lambda natively and has first-party Begin support.
            Other deployment targets require more manual configuration.
          </p>
          <p>
            Litro uses Nitro, which has first-party deployment presets for Vercel, Cloudflare Workers,
            AWS Lambda, Deno Deploy, Netlify, Bun, and more. These are the same presets used by Nuxt.js
            in production across thousands of sites.
          </p>

          <!-- Key difference: client routing -->
          <h2>Client-Side Routing</h2>
          <p>
            Enhance is primarily a multi-page application (MPA) framework. Navigation triggers full
            page loads by default. Client-side interactivity is added progressively via <code>&lt;script&gt;</code>
            tags in component files. There's no built-in SPA router.
          </p>
          <p>
            Litro includes <strong>LitroRouter</strong> — a built-in client-side router built on the
            native URLPattern API. Navigation between routes is SPA-style with no full page reload.
            Use <code>&lt;litro-link&gt;</code> for SPA navigation; plain <code>&lt;a&gt;</code> tags
            do full page reloads.
          </p>

          <!-- Honest trade-offs -->
          <h2>When to Choose Enhance</h2>
          <p>
            Enhance is an excellent choice if you want:
          </p>
          <ul>
            <li>Zero JavaScript by default — pages are static HTML, enhancement is strictly opt-in</li>
            <li>The simplest possible component authoring model (no library dependency)</li>
            <li>A Begin/Arc-centric deployment model (deep AWS integration out of the box)</li>
            <li>Minimal abstraction — components are functions, not classes</li>
          </ul>

          <h2>When to Choose Litro</h2>
          <p>
            Litro is a better fit if you want:
          </p>
          <ul>
            <li>Client-side routing (SPA-style navigation without full page reloads)</li>
            <li>The Lit ecosystem — Shoelace, <code>@lit/context</code>, community components</li>
            <li>Nitro's deployment flexibility (Vercel, Cloudflare Workers, and more)</li>
            <li>Migrating from Nuxt.js — the server layer is identical</li>
            <li>Full TypeScript across the component model</li>
          </ul>

          <!-- CTA -->
          <div class="cta">
            <sl-button variant="primary" size="medium" href="/docs/getting-started">
              Get Started with Litro
            </sl-button>
            <sl-button variant="default" size="medium" href="/why-web-components">
              Why Web Components?
            </sl-button>
          </div>
        </main>
      </div>
    `;
  }
}

export default CompareEnhancePage;
