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

export interface CompareNextjsData {
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

export const pageData = definePageData(async (_event) => {
  const seoTitle = 'Litro vs Next.js: File-Based Routing and SSR Without React';
  const description = 'Compare Litro and Next.js side by side. Both offer file-based routing, SSR, and TypeScript — the difference is the component model and what you\'re betting on long-term.';

  const seoHead = buildSeoHead({
    title: seoTitle,
    description,
    path: '/compare/nextjs',
    type: 'article',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': seoTitle,
    'description': description,
    'url': 'https://litro.dev/compare/nextjs',
    'about': [
      { '@type': 'SoftwareApplication', 'name': 'Litro', 'url': 'https://litro.dev' },
      { '@type': 'SoftwareApplication', 'name': 'Next.js', 'url': 'https://nextjs.org' },
    ],
  });

  return {
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies CompareNextjsData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Litro vs Next.js',
};

@customElement('page-compare-nextjs')
export class CompareNextjsPage extends LitroPage {
  static override styles = compareStyles;

  override render() {
    const data = this.serverData as CompareNextjsData | null;
    const siteTitle = data?.siteTitle ?? 'Litro';
    const nav = data?.nav ?? [];

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/compare/nextjs"
        ></starlight-header>

        <main>
          <h1>Litro vs Next.js</h1>
          <p class="intro">
            Both frameworks solve the same core problems — SSR, file-based routing, TypeScript, deployment
            adapters. The difference is the component model and what you're betting on long-term:
            React's ecosystem today, or web platform standards for the next decade.
          </p>

          <!-- Feature comparison table -->
          <h2>Feature Comparison</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Next.js</th>
                  <th>Litro</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Component model</td><td>React (JSX)</td><td>Lit (web components)</td></tr>
                <tr><td>File-based routing</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>SSR</td><td>React Server Components</td><td>Declarative Shadow DOM streaming</td></tr>
                <tr><td>SSG</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>Data fetching</td><td><code>fetch()</code> in Server Components</td><td><code>definePageData()</code></td></tr>
                <tr><td>API routes</td><td><code>app/api/route.ts</code></td><td><code>server/api/*.ts</code> (H3)</td></tr>
                <tr><td>Client routing</td><td>Next Router</td><td>LitroRouter (URLPattern)</td></tr>
                <tr><td>Hello World JS (gzipped)</td><td>~90 kB</td><td>~8 kB</td></tr>
                <tr><td>Server engine</td><td>Custom</td><td>Nitro (same as Nuxt)</td></tr>
                <tr><td>Virtual DOM</td><td class="check">✓</td><td class="dash">—</td></tr>
                <tr><td>W3C standard components</td><td class="dash">—</td><td class="check">✓</td></tr>
                <tr><td>TypeScript</td><td class="check">✓</td><td class="check">✓</td></tr>
                <tr><td>License</td><td>MIT</td><td>Apache 2.0</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Side-by-side: a simple page -->
          <h2>Side by Side: A Simple Page</h2>

          <div class="code-compare">
            <div>
              <p class="pane-label">Next.js — app/about/page.tsx</p>
              <pre><code>export default function AboutPage() {
  return (
    &lt;main&gt;
      &lt;h1&gt;About&lt;/h1&gt;
      &lt;p&gt;We build web frameworks.&lt;/p&gt;
    &lt;/main&gt;
  );
}</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — pages/about.ts</p>
              <pre><code>import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';

@customElement('page-about')
export class AboutPage extends LitroPage {
  override render() {
    return html\`
      &lt;main&gt;
        &lt;h1&gt;About&lt;/h1&gt;
        &lt;p&gt;We build web frameworks.&lt;/p&gt;
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
              <p class="pane-label">Next.js — Server Component</p>
              <pre><code>// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: { slug: string };
}) {
  const post = await db.getPost(params.slug);
  return (
    &lt;article&gt;
      &lt;h1&gt;{post.title}&lt;/h1&gt;
      &lt;div dangerouslySetInnerHTML=
        {{ __html: post.body }} /&gt;
    &lt;/article&gt;
  );
}</code></pre>
            </div>
            <div>
              <p class="pane-label">Litro — definePageData()</p>
              <pre><code>// pages/blog/[slug].ts
export const pageData = definePageData(
  async (event) => {
    const slug = event.context.params?.slug;
    const post = await db.getPost(slug);
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

          <!-- What carries over -->
          <h2>What Carries Over</h2>
          <ul>
            <li><strong>File-based routing</strong> — same <code>pages/</code> convention, same dynamic segment syntax (<code>[slug]</code>, <code>[...all]</code>)</li>
            <li><strong>API routes</strong> — same concept, different handler format (H3 instead of Web Request/Response)</li>
            <li><strong>TypeScript throughout</strong> — Litro is TypeScript-first</li>
            <li><strong>Deployment adapters</strong> — Litro uses Nitro, which has Vercel, Cloudflare Workers, AWS Lambda, and more as first-party presets</li>
            <li><strong>SSG</strong> — export <code>generateRoutes()</code> instead of <code>generateStaticParams()</code></li>
          </ul>

          <!-- What changes -->
          <h2>What Changes</h2>
          <ul>
            <li><strong>React → Lit</strong> — function components become class components; JSX becomes tagged template literals</li>
            <li><strong>No React runtime</strong> — the client bundle drops from ~90 kB to ~8 kB for Hello World</li>
            <li><strong>Shadow DOM instead of CSS Modules</strong> — component styles are scoped at the browser level</li>
            <li><strong>H3 API routes</strong> — import <code>defineEventHandler</code> from <code>h3</code> rather than using Next's Web Request/Response format</li>
            <li><strong>Server engine</strong> — Nitro instead of Next's custom server (more deployment targets, same Vercel support)</li>
          </ul>

          <!-- Why this trade-off -->
          <h2>Why This Trade-Off?</h2>
          <p>
            React will eventually be replaced by something — Angular was replaced by React, and the same
            pattern will repeat. Every migration costs weeks of developer time. Web components are a W3C
            specification: Custom Elements, Shadow DOM, and <code>&lt;template&gt;</code> are implemented
            natively in every major browser and will continue to be for decades.
          </p>
          <p>
            This isn't a criticism of React. For large teams with years of React investment, the migration
            cost is real and often not worth it. Litro is for developers starting new projects who want
            to bet on the platform rather than a library.
          </p>
          <p>
            Read more: <a href="/why-web-components">Why Web Components? The case for standards-based development</a>
          </p>

          <!-- CTA -->
          <div class="cta">
            <sl-button variant="primary" size="medium" href="/docs/getting-started">
              Get Started with Litro
            </sl-button>
            <sl-button variant="default" size="medium" href="/docs/migrate/from-nextjs">
              Next.js Migration Guide
            </sl-button>
          </div>
        </main>
      </div>
    `;
  }
}

export default CompareNextjsPage;
