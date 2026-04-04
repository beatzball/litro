/**
 * Unit tests for docs/src/seo.ts — buildSeoHead() and buildJsonLd().
 *
 * Both functions are pure (no I/O, no DOM), so no mocking is needed.
 * SITE_URL env var is not set in tests, so siteUrl defaults to 'https://litro.dev'.
 *
 * Run with: pnpm test:docs
 */

import { describe, it, expect } from 'vitest';
import { buildSeoHead, buildJsonLd } from '../seo.js';

// ---------------------------------------------------------------------------
// buildSeoHead
// ---------------------------------------------------------------------------

describe('buildSeoHead — meta description', () => {
  it('includes a <meta name="description"> tag', () => {
    const result = buildSeoHead({ title: 'Test', description: 'A test page.', path: '/test' });
    expect(result).toContain('<meta name="description"');
  });

  it('embeds the description in the content attribute', () => {
    const result = buildSeoHead({ title: 'Test', description: 'A test page.', path: '/test' });
    expect(result).toContain('content="A test page."');
  });
});

describe('buildSeoHead — canonical link', () => {
  it('includes a <link rel="canonical"> tag', () => {
    const result = buildSeoHead({ title: 'Test', description: 'Desc', path: '/about' });
    expect(result).toContain('<link rel="canonical"');
  });

  it('canonical href is the full absolute URL', () => {
    const result = buildSeoHead({ title: 'Test', description: 'Desc', path: '/about' });
    expect(result).toContain('href="https://litro.dev/about"');
  });
});

describe('buildSeoHead — Open Graph tags', () => {
  const base = { title: 'My Page', description: 'Page description', path: '/page' };

  it('includes og:title', () => {
    expect(buildSeoHead(base)).toContain('<meta property="og:title" content="My Page" />');
  });

  it('includes og:description', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:description" content="Page description" />',
    );
  });

  it('defaults og:type to "website"', () => {
    expect(buildSeoHead(base)).toContain('<meta property="og:type" content="website" />');
  });

  it('uses "article" og:type when specified', () => {
    expect(buildSeoHead({ ...base, type: 'article' })).toContain(
      '<meta property="og:type" content="article" />',
    );
  });

  it('includes og:url as the full absolute URL', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:url" content="https://litro.dev/page" />',
    );
  });

  it('includes og:image with path-based URL', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:image" content="https://litro.dev/__og/page.png" />',
    );
  });

  it('uses /__og/index.png for root path /', () => {
    const result = buildSeoHead({ title: 'Home', description: 'Home page', path: '/' });
    expect(result).toContain(
      '<meta property="og:image" content="https://litro.dev/__og/index.png" />',
    );
  });

  it('uses custom image override when provided', () => {
    const result = buildSeoHead({ ...base, image: 'https://example.com/custom.png' });
    expect(result).toContain(
      '<meta property="og:image" content="https://example.com/custom.png" />',
    );
  });

  it('includes og:image:width of 1200', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:image:width" content="1200" />',
    );
  });

  it('includes og:image:height of 630', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:image:height" content="630" />',
    );
  });

  it('includes og:site_name defaulting to Litro', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta property="og:site_name" content="Litro" />',
    );
  });

  it('uses custom siteName when provided', () => {
    const result = buildSeoHead({ ...base, siteName: 'My Docs' });
    expect(result).toContain(
      '<meta property="og:site_name" content="My Docs" />',
    );
  });
});

describe('buildSeoHead — twitter:image', () => {
  it('twitter:image matches og:image URL', () => {
    const result = buildSeoHead({ title: 'T', description: 'D', path: '/page' });
    expect(result).toContain(
      '<meta name="twitter:image" content="https://litro.dev/__og/page.png" />',
    );
  });
});

describe('buildSeoHead — Twitter card tags', () => {
  const base = { title: 'Blog Post', description: 'A blog post.', path: '/blog/post' };

  it('includes twitter:card set to summary_large_image', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
  });

  it('includes twitter:title', () => {
    expect(buildSeoHead(base)).toContain('<meta name="twitter:title" content="Blog Post" />');
  });

  it('includes twitter:description', () => {
    expect(buildSeoHead(base)).toContain(
      '<meta name="twitter:description" content="A blog post." />',
    );
  });
});

describe('buildSeoHead — sitemap link', () => {
  it('includes a link to /sitemap.xml', () => {
    const result = buildSeoHead({ title: 'T', description: 'D', path: '/' });
    expect(result).toContain(
      '<link rel="sitemap" type="application/xml" href="/sitemap.xml" />',
    );
  });
});

describe('buildSeoHead — attribute escaping', () => {
  it('escapes & in title', () => {
    const result = buildSeoHead({ title: 'Lit & Friends', description: 'Desc', path: '/' });
    expect(result).toContain('Lit &amp; Friends');
    expect(result).not.toContain('Lit & Friends');
  });

  it('escapes " in description', () => {
    const result = buildSeoHead({ title: 'T', description: 'Say "hello"', path: '/' });
    expect(result).toContain('Say &quot;hello&quot;');
  });

  it('escapes < and > in description', () => {
    const result = buildSeoHead({ title: 'T', description: '<b>bold</b>', path: '/' });
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes & in description', () => {
    const result = buildSeoHead({ title: 'T', description: 'A & B', path: '/' });
    expect(result).toContain('A &amp; B');
    expect(result).not.toContain('content="A & B"');
  });
});

describe('buildSeoHead — return type', () => {
  it('returns a string', () => {
    const result = buildSeoHead({ title: 'T', description: 'D', path: '/' });
    expect(typeof result).toBe('string');
  });

  it('returns a non-empty string', () => {
    const result = buildSeoHead({ title: 'T', description: 'D', path: '/' });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildJsonLd
// ---------------------------------------------------------------------------

describe('buildJsonLd — output structure', () => {
  it('returns a <script type="application/ld+json"> tag', () => {
    const result = buildJsonLd({ '@type': 'SoftwareApplication' });
    expect(result).toMatch(/^<script type="application\/ld\+json">/);
    expect(result).toMatch(/<\/script>$/);
  });

  it('embeds the JSON-stringified data inside the script tag', () => {
    const data = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: 'Test' };
    const result = buildJsonLd(data);
    expect(result).toContain(JSON.stringify(data));
  });

  it('the embedded JSON is parseable', () => {
    const data = { name: 'Litro', version: '0.2.0', active: true };
    const result = buildJsonLd(data);
    const json = result
      .replace('<script type="application/ld+json">', '')
      .replace('</script>', '');
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(data);
  });
});

describe('buildJsonLd — data types', () => {
  it('handles nested objects', () => {
    const data = { author: { '@type': 'Organization', name: 'beatzball' } };
    const result = buildJsonLd(data);
    expect(result).toContain('"beatzball"');
    expect(result).toContain('"author"');
  });

  it('handles arrays', () => {
    const data = { programmingLanguage: ['TypeScript', 'JavaScript'] };
    const result = buildJsonLd(data);
    expect(result).toContain('["TypeScript","JavaScript"]');
  });

  it('handles numeric values', () => {
    const data = { offers: { price: 0 } };
    const result = buildJsonLd(data);
    expect(result).toContain('"price":0');
  });

  it('handles an empty object', () => {
    const result = buildJsonLd({});
    expect(result).toBe('<script type="application/ld+json">{}</script>');
  });
});

describe('buildJsonLd — SoftwareApplication schema (integration)', () => {
  it('produces a valid structured data script for a SoftwareApplication', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Litro',
      applicationCategory: 'DeveloperApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
    const result = buildJsonLd(data);
    expect(result).toContain('"@type":"SoftwareApplication"');
    expect(result).toContain('"applicationCategory":"DeveloperApplication"');
    expect(result).toContain('"price":"0"');
  });
});
