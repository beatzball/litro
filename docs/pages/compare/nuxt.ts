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

export interface CompareNuxtData {
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

export const pageData = definePageData(async (_event) => {
  const seoTitle = 'Litro vs Nuxt.js: Same Nitro Server, Different Component Model';
  const description = 'Compare Litro and Nuxt.js. Both run on Nitro — the same server engine, the same deployment adapters. The difference is Vue vs Lit for components.';

  const seoHead = buildSeoHead({
    title: seoTitle,
    description,
    path: '/compare/nuxt',
    type: 'article',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': seoTitle,
    'description': description,
    'url': 'https://litro.dev/compare/nuxt',
    'about': [
      { '@type': 'SoftwareApplication', 'name': 'Litro', 'url': 'https://litro.dev' },
      { '@type': 'SoftwareApplication', 'name': 'Nuxt.js', 'url': 'https://nuxt.com' },
    ],
  });

  return {
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies CompareNuxtData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Litro vs Nuxt.js',
};

@customElement('page-compare-nuxt')
export class CompareNuxtPage extends LitroPage {
  static override styles = compareStyles;

  override render() {
    const data = this.serverData as CompareNuxtData | null;
    const siteTitle = data?.siteTitle ?? 'Litro';
    const nav = data?.nav ?? [];

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/compare/nuxt"
        ></starlight-header>

        <main>
          <h1>Litro vs Nuxt.js</h1>

          <div class="callout">
            <strong>Shared foundation:</strong> Litro and Nuxt.js both run on
            <strong>Nitro</strong> — the same server engine, the same deployment adapters,
            the same H3 API routes. If you're migrating from Nuxt, your server-side code
            largely copies verbatim.
          </div>

          <p class="intro">
            The difference between Litro and Nuxt is the component model.
            Nuxt uses Vue Single File Components; Litro uses Lit web components.
            Everything under the server layer — Nitro, H3, deployment presets — is shared.
          </p>

          <!-- Feature comparison table -->
          <h2>Feature Comparison</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Nuxt.js</th>
                  <th>Litro</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Component model</td><td>Vue 3 (SFC)</td><td>Lit (web components)</td></tr>
                <tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>SSR</td><td>Vue SSR</td><td>Declarative Shadow DOM streaming</td></tr>
                <tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>Data fetching</td><td><code>useFetch</code> / <code>useAsyncData</code></td><td><code>definePageData()</code></td></tr>
                <tr><td>API routes</td><td><code>server/api/*.ts</code> (H3)</td><td class="same">Identical ↔</td></tr>
                <tr><td>Server engine</td><td>Nitro</td><td class="same">Identical ↔</td></tr>
                <tr><td>Deployment adapters</td><td>All Nitro presets</td><td class="same">Identical ↔</td></tr>
                <tr><td>Client routing</td><td>vue-router</td><td>LitroRouter (URLPattern)</td></tr>
                <tr><td>Hello World JS (gzipped)</td><td>~60 kB</td><td>~8 kB</td></tr>
                <tr><td>Virtual DOM</td><td class="check">✓ (Vue)</td><td class="dash">—</td></tr>
                <tr><td>W3C standard components</td><td class="dash">—</td><td class="check">✓</td></tr>
                <tr><td>TypeScript</td><td class="check">✓</td><td class="check">✓</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Side-by-side: a page -->
          <h2>Side by Side: A Page Component</h2>

          <div class="code-compare">
            <div>
              <p class="pane-label">Nuxt — pages/about.vue</p>
              <pre><code>&lt;script setup lang="ts"&gt;
const title = 'About Us';
const items = ['SSR', 'SSG', 'Nitro'];
&lt;/script&gt;

&lt;template&gt;
  &lt;main&gt;
    &lt;h1&gt;{{ title }}&lt;/h1&gt;
    &lt;ul&gt;
      &lt;li v-for="item in items"&gt;
        {{ item }}
      &lt;/li&gt;
    &lt;/ul&gt;
  &lt;/main&gt;
&lt;/template&gt;</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — pages/about.ts</p>
              <pre><code>import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

const items = ['SSR', 'SSG', 'Nitro'];

@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html\`
      &lt;main&gt;
        &lt;h1&gt;About Us&lt;/h1&gt;
        &lt;ul&gt;
          \${items.map(i => html\`&lt;li&gt;\${i}&lt;/li&gt;\`)}
        &lt;/ul&gt;
      &lt;/main&gt;
    \`;
  }
}
export default AboutPage;</code></pre>
            </div>
          </div>

          <!-- Side-by-side: data fetching -->
          <h2>Side by Side: Data Fetching</h2>

          <div class="code-compare">
            <div>
              <p class="pane-label">Nuxt — pages/blog/[slug].vue</p>
              <pre><code>&lt;script setup lang="ts"&gt;
const route = useRoute();
const { data: post } = await useFetch(
  \`/api/posts/\${route.params.slug}\`
);
&lt;/script&gt;

&lt;template&gt;
  &lt;article&gt;
    &lt;h1&gt;{{ post?.title }}&lt;/h1&gt;
    &lt;div v-html="post?.body"&gt;&lt;/div&gt;
  &lt;/article&gt;
&lt;/template&gt;</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — pages/blog/[slug].ts</p>
              <pre><code>export const pageData = definePageData(
  async (event) => {
    const slug = event.context.params?.slug;
    const post = await $fetch(
      \`/api/posts/\${slug}\`
    );
    return { post };
  }
);

@customElement('page-blog-slug')
export class BlogPost extends LitroPage {
  override render() {
    const { post } = this.serverData ?? {};
    if (!post) return html\`&lt;p&gt;Loading…&lt;/p&gt;\`;
    return html\`
      &lt;article&gt;
        &lt;h1&gt;\${post.title}&lt;/h1&gt;
        \${unsafeHTML(post.body)}
      &lt;/article&gt;
    \`;
  }
}</code></pre>
            </div>
          </div>

          <!-- API routes -->
          <h2>API Routes Are Identical</h2>
          <p>
            H3 API route handlers are copy-paste compatible. The only difference:
            Nuxt auto-imports <code>defineEventHandler</code>; Litro requires an explicit import.
          </p>

          <div class="code-compare">
            <div>
              <p class="pane-label">Nuxt — server/api/posts.ts</p>
              <pre><code>// defineEventHandler is auto-imported
export default defineEventHandler(async () => {
  return await db.getPosts();
});</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — server/api/posts.ts</p>
              <pre><code>import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  return await db.getPosts();
});</code></pre>
            </div>
          </div>

          <!-- What carries over -->
          <h2>What Carries Over</h2>
          <ul>
            <li><strong>H3 API routes</strong> — copy as-is, add the explicit <code>h3</code> import</li>
            <li><strong>Server middleware</strong> — <code>server/middleware/*.ts</code> is identical</li>
            <li><strong>Deployment targets</strong> — all Nitro presets work identically: Vercel, Cloudflare Workers, AWS Lambda, Deno Deploy, static, and more</li>
            <li><strong>Route rules</strong> — <code>routeRules</code> in <code>nitro.config.ts</code> is the same API</li>
            <li><strong>File-based routing convention</strong> — <code>[slug]</code>, <code>[...all]</code> work the same</li>
          </ul>

          <!-- What changes -->
          <h2>What Changes</h2>
          <ul>
            <li><strong>Vue SFCs → Lit class components</strong> — <code>&lt;script setup&gt;</code> becomes <code>definePageData()</code>; <code>&lt;template&gt;</code> becomes <code>render()</code></li>
            <li><strong>No Vue runtime</strong> — bundle drops from ~60 kB to ~8 kB</li>
            <li><strong>vue-router → LitroRouter</strong> — different API, built on URLPattern</li>
            <li><strong><code>&lt;NuxtLink&gt;</code> → <code>&lt;litro-link&gt;</code></strong> — SPA navigation; attribute is <code>href</code> not <code>to</code></li>
          </ul>

          <!-- Why switch -->
          <h2>Why Switch?</h2>
          <p>
            Vue will eventually be superseded by something else — the same way Angular gave way to React.
            Web components are a W3C specification that browsers implement natively. Components built with
            Lit today will still work in browsers shipping in 2040, without a migration.
          </p>
          <p>
            If you've already invested in Nitro's ecosystem (server knowledge, deployment pipelines,
            H3 handler patterns), switching to Litro means you keep all of that and only replace the
            component layer. The Nitro investment carries forward entirely.
          </p>

          <!-- CTA -->
          <div class="cta">
            <sl-button variant="primary" size="medium" href="/docs/getting-started">
              Get Started with Litro
            </sl-button>
            <sl-button variant="default" size="medium" href="/docs/migrate/from-nuxt">
              Nuxt Migration Guide
            </sl-button>
          </div>
        </main>
      </div>
    `;
  }
}

export default CompareNuxtPage;
