import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '../src/seo.js';
import { compareStyles } from '../src/compare-styles.js';

// Register components used in render()
import '../src/components/starlight-header.js';

export interface WhyWebComponentsData {
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

export const pageData = definePageData(async (_event) => {
  const seoTitle = 'Why Web Components? The Case for Standards-Based Development in 2026';
  const description = 'React replaced Angular. Something will replace React. Every framework migration costs weeks of developer time. Web components are a W3C standard — the same bet as the DOM API from 1998.';

  const seoHead = buildSeoHead({
    title: seoTitle,
    description,
    path: '/why-web-components',
    type: 'article',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': seoTitle,
    'description': description,
    'url': 'https://litro.dev/why-web-components',
    'author': { '@type': 'Organization', 'name': 'beatzball' },
    'publisher': { '@type': 'Organization', 'name': 'Litro', 'url': 'https://litro.dev' },
  });

  return {
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies WhyWebComponentsData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Why Web Components? — Litro',
};

@customElement('page-why-web-components')
export class WhyWebComponentsPage extends LitroPage {
  static override styles = compareStyles;

  override render() {
    const data = this.serverData as WhyWebComponentsData | null;
    const siteTitle = data?.siteTitle ?? 'Litro';
    const nav = data?.nav ?? [];

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/why-web-components"
        ></starlight-header>

        <main>
          <h1>Why Web Components?</h1>
          <p class="intro">
            The case for standards-based development in 2026 — and why we think web components
            are the right foundation for a fullstack framework.
          </p>

          <h2>The Framework Treadmill</h2>
          <p>
            In 2012, AngularJS was the dominant JavaScript framework. In 2013, React launched
            and gradually displaced it. By 2018, most new projects started with React. Vue and
            Svelte followed, each offering a different trade-off. Angular 2 was rewritten from
            scratch — incompatible with AngularJS. React itself is now on its third architecture
            (classes → hooks → Server Components), each requiring significant rewrites in large
            codebases.
          </p>
          <p>
            This isn't a criticism of any specific framework. The teams behind React, Vue, and
            Angular have made genuinely good engineering decisions given the constraints they had.
            The pattern is structural: the web platform has been evolving faster than any framework
            can track, and frameworks built on top of proprietary abstractions accumulate migration
            debt as the platform matures.
          </p>
          <p>
            Every time a new framework displaces an old one, developers pay the migration cost.
            Not just rewriting component code, but also retraining, updating tooling, migrating
            state management, re-evaluating component libraries, and rebuilding institutional
            knowledge. For a large team, a full framework migration is a multi-month project.
          </p>

          <h2>What Web Components Actually Are</h2>
          <p>
            Web components are not a framework. They're three W3C specifications implemented
            natively in every major browser:
          </p>
          <ul>
            <li>
              <strong>Custom Elements</strong> — register your own HTML elements.
              <code>&lt;my-button&gt;</code> is a real HTML element, not a framework construct.
            </li>
            <li>
              <strong>Shadow DOM</strong> — scoped DOM subtrees with encapsulated CSS.
              Your component's styles don't leak out; global styles don't leak in.
            </li>
            <li>
              <strong><code>&lt;template&gt;</code> and <code>&lt;slot&gt;</code></strong> —
              declarative component composition. Slots work like React's <code>children</code>
              prop, but in the browser.
            </li>
          </ul>
          <p>
            Custom Elements reached Baseline (supported in all major browsers) in 2019.
            Shadow DOM in 2019. Declarative Shadow DOM (server-rendering support) in
            Firefox 119 (Nov 2023), Safari 16.4, Chrome 111 — Baseline as of 2024.
            No polyfills required.
          </p>

          <h2>What Lit Adds</h2>
          <p>
            Lit is a 6 kB library (gzipped) that adds three things on top of the native APIs:
          </p>
          <ul>
            <li>
              <strong>Reactive properties</strong> — declare which properties trigger re-renders,
              which reflect to HTML attributes, and which are internal state.
            </li>
            <li>
              <strong>Tagged template rendering</strong> — the <code>html\`...\`</code> template
              tag parses HTML once and updates only the dynamic parts on re-render.
            </li>
            <li>
              <strong>Lifecycle and SSR support</strong> — <code>@lit-labs/ssr</code> renders
              Lit components to Declarative Shadow DOM on the server, enabling full SSR without
              JavaScript on the client.
            </li>
          </ul>
          <p>
            Lit is not a runtime in the React sense. It doesn't own a virtual DOM or diff tree.
            It's a thin ergonomic layer over the native Custom Elements API. If Lit disappeared
            tomorrow, the components it produces would still run natively in every browser — they
            are spec-compliant Custom Elements.
          </p>

          <h2>The Longevity Argument</h2>
          <p>
            Consider the timeline of web platform APIs:
          </p>
          <ul>
            <li>The DOM API (1998) still works — unchanged in every browser</li>
            <li><code>XMLHttpRequest</code> (1999) — deprecated but still works, no breaking changes</li>
            <li><code>&lt;input type="date"&gt;</code> (2012) — still works identically</li>
            <li><code>requestAnimationFrame</code> (2011) — still works identically</li>
            <li>CSS Grid (2017) — still works identically</li>
          </ul>
          <p>
            Platform APIs have a stability guarantee that framework APIs don't. Browser vendors
            have a strong incentive not to break existing sites — it's one of the web's core
            properties. A Custom Element defined today to the specification will still work in
            browsers shipping in 2040.
          </p>
          <p>
            This is not a prediction that React will fail. It's a structural observation: the
            longer a codebase exists, the more valuable stability becomes. Teams that have
            maintained codebases for 5–10 years understand this better than teams building
            their first project.
          </p>

          <h2>Honest Trade-offs</h2>
          <p>
            Web components in 2026 have real trade-offs. Naming them directly:
          </p>
          <ul>
            <li>
              <strong>Smaller ecosystem</strong> — React has more component libraries, more
              StackOverflow answers, more tutorials. The gap is closing (Shoelace, FAST,
              Lion, Spectrum Web Components), but it's real.
            </li>
            <li>
              <strong>Different DX</strong> — class-based components feel different from
              React function components. The Lit team has made them ergonomic, but they're
              not JSX.
            </li>
            <li>
              <strong>SSR complexity</strong> — Declarative Shadow DOM is a newer spec.
              <code>@lit-labs/ssr</code> works well, but you're in a smaller community of
              practitioners than React SSR.
            </li>
            <li>
              <strong>CSS encapsulation trade-off</strong> — Shadow DOM scoping is a feature,
              but it means global design tokens must use CSS custom properties
              (<code>var(--color-primary)</code>) to cross the shadow boundary. This is a
              different mental model than CSS Modules.
            </li>
          </ul>
          <p>
            These are real costs. For teams with deep React investment, the migration cost
            is likely not worth it. Web components are the right choice for teams starting
            new projects who want to minimize long-term migration risk.
          </p>

          <h2>Litro as the Batteries-Included Entry Point</h2>
          <p>
            Assembling web components, SSR, file-based routing, data fetching, and deployment
            adapters from scratch is possible but requires significant expertise. Litro provides
            all of it as a cohesive framework:
          </p>
          <ul>
            <li>File-based routing — <code>pages/</code> directory maps to URLs automatically</li>
            <li>Streaming SSR — <code>@lit-labs/ssr</code> + Nitro with no configuration</li>
            <li><code>definePageData()</code> — server-side data fetching, serialized to the client</li>
            <li>LitroRouter — built-in SPA router using the URLPattern API</li>
            <li>Deployment adapters — Vercel, Cloudflare Workers, AWS Lambda via Nitro presets</li>
            <li>Content layer — Markdown with 11ty-compatible frontmatter</li>
          </ul>
          <p>
            You don't have to evaluate each piece independently. Litro makes the standards-based
            bet as low-friction as possible.
          </p>

          <!-- CTA -->
          <div class="cta">
            <sl-button variant="primary" size="medium" href="/docs/getting-started">
              Get Started
            </sl-button>
            <sl-button variant="default" size="medium" href="/compare/nextjs">
              Litro vs Next.js
            </sl-button>
            <sl-button variant="default" size="medium" href="/compare/nuxt">
              Litro vs Nuxt.js
            </sl-button>
          </div>
        </main>
      </div>
    `;
  }
}

export default WhyWebComponentsPage;
