import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';

export interface SplashData {
  siteTitle: string;
  description: string;
  nav: Array<{ label: string; href: string }>;
  features: Array<{ title: string; description: string; icon?: string }>;
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  return {
    siteTitle: String(metadata.title ?? siteConfig.title),
    description: String(metadata.description ?? siteConfig.description),
    nav: siteConfig.nav,
    features: [
      { icon: '\u{1F4C4}', title: 'Docs', description: 'Structured documentation with sidebar, TOC, and prev/next navigation.' },
      { icon: '\u270D\uFE0F', title: 'Blog', description: 'Write posts in Markdown. Tags, dates, and listing pages auto-generated.' },
      { icon: '\u{1F3A8}', title: 'Theming', description: 'Light and dark mode via CSS custom properties. Zero JavaScript required.' },
      { icon: '\u26A1', title: 'Static', description: 'Pre-rendered to plain HTML. Deploy to any CDN with no server required.' },
    ],
  } satisfies SplashData;
});

export const routeMeta = {
  head: starlightHead,
  title: '{{projectName}}',
};

export class SplashPage extends LitroPage {
  static override tagName = 'page-home';

  render() {
    const data = this.serverData as SplashData | null;
    const siteTitle = data?.siteTitle ?? '{{projectName}}';
    const description = data?.description ?? '';
    const nav = data?.nav ?? [];
    const features = data?.features ?? [];

    const navHtml = nav.map(item =>
      `<a href="${item.href}" class="nav-link">${item.label}</a>`
    ).join('');

    const descHtml = description
      ? `<p class="hero-desc">${description}</p>`
      : '';

    const cardsHtml = features.map(f =>
      `<div class="feature-card">
        <div class="card-header">
          ${f.icon ? `<span class="card-icon">${f.icon}</span>` : ''}
          <p class="card-title">${f.title}</p>
        </div>
        <p class="card-desc">${f.description}</p>
      </div>`
    ).join('');

    return html`
      <style>
        @scope (page-home) {
          :scope { display: block; }
          .page-wrap { min-height: 100vh; display: flex; flex-direction: column; }
          .header {
            height: var(--sl-nav-height, 3.5rem);
            background-color: var(--sl-color-bg-nav, #fff);
            border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
            display: flex; align-items: center;
            padding: 0 var(--sl-content-pad-x, 1.5rem); gap: 1rem;
            position: sticky; top: 0; z-index: 100;
          }
          .site-title {
            font-size: var(--sl-text-lg, 1.125rem); font-weight: 700;
            color: var(--sl-color-text, #23262f); text-decoration: none; white-space: nowrap;
          }
          .site-title:hover { opacity: 0.85; }
          .nav { display: flex; align-items: center; gap: 0.25rem; flex: 1; }
          .nav-link {
            padding: 0.35rem 0.75rem; font-size: var(--sl-text-sm, 0.875rem); font-weight: 500;
            color: var(--sl-color-gray-5, #4b4b4b); text-decoration: none;
            border-radius: var(--sl-border-radius, 0.375rem); transition: color 0.15s, background-color 0.15s;
          }
          .nav-link:hover { color: var(--sl-color-text, #23262f); background-color: var(--sl-color-gray-2, #e8e8e8); }
          .main { flex: 1; max-width: 56rem; margin: 0 auto; padding: 4rem 1.5rem 3rem; width: 100%; }
          .hero { text-align: center; margin-bottom: 4rem; }
          .hero h1 { font-size: clamp(2rem,5vw,3.5rem); font-weight: 800; color: var(--sl-color-text); margin: 0 0 1rem; line-height: 1.1; }
          .hero-desc { font-size: var(--sl-text-xl); color: var(--sl-color-gray-4); max-width: 36rem; margin: 0 auto 2.5rem; line-height: 1.6; }
          .hero-cta { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
          .btn-primary {
            display: inline-block; padding: 0.6rem 1.5rem; background: var(--sl-color-accent);
            color: var(--sl-color-text-invert, #fff); border-radius: var(--sl-border-radius);
            font-weight: 600; text-decoration: none; font-size: var(--sl-text-base);
          }
          .btn-secondary {
            display: inline-block; padding: 0.6rem 1.5rem; border: 1px solid var(--sl-color-border);
            color: var(--sl-color-text); border-radius: var(--sl-border-radius);
            font-weight: 600; text-decoration: none; font-size: var(--sl-text-base);
          }
          .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1.25rem; }
          .feature-card {
            display: flex; flex-direction: column; padding: 1.25rem 1.5rem;
            border: 1px solid var(--sl-color-border, #e8e8e8); border-radius: var(--sl-border-radius, 0.375rem);
            background-color: var(--sl-color-bg, #fff); border-top: 4px solid var(--sl-color-accent, #7c3aed);
          }
          .feature-card:nth-child(2) { border-top-color: var(--sl-color-note, #1d4ed8); }
          .feature-card:nth-child(3) { border-top-color: var(--sl-color-tip, #15803d); }
          .feature-card:nth-child(4) { border-top-color: var(--sl-color-caution, #b45309); }
          .card-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
          .card-icon { font-size: 1.5rem; flex-shrink: 0; line-height: 1; }
          .card-title { font-size: var(--sl-text-lg, 1.125rem); font-weight: 600; color: var(--sl-color-text, #23262f); margin: 0; }
          .card-desc { font-size: var(--sl-text-sm, 0.875rem); color: var(--sl-color-gray-4, #757575); margin: 0; line-height: 1.6; }
        }
      </style>
      <div class="page-wrap">
        <header class="header">
          <a class="site-title" href="/">${siteTitle}</a>
          <nav class="nav" aria-label="Main navigation">${unsafeHTML(navHtml)}</nav>
        </header>
        <main class="main">
          <section class="hero">
            <h1>${siteTitle}</h1>
            ${unsafeHTML(descHtml)}
            <div class="hero-cta">
              <a href="/docs/getting-started" class="btn-primary">Get Started</a>
              <a href="/blog" class="btn-secondary">Blog</a>
            </div>
          </section>
          <section>
            <div class="card-grid">${unsafeHTML(cardsHtml)}</div>
          </section>
        </main>
      </div>
    `;
  }
}

SplashPage.define();

export default SplashPage;
