---
title: "Why Web Components? The Case for Standards-Based Development"
description: "Web components are a W3C standard built into every major browser. Here's why betting on the platform — rather than a framework — is the right long-term choice for new projects."
date: 2026-03-21
---

# Why Web Components?

Custom Elements, Shadow DOM, and `<slot>` are W3C specifications implemented natively in every
major browser. They're part of the web platform itself — the same layer as `<video>`, CSS Grid,
and the Fetch API — not a library that needs to be installed, updated, or maintained.

Lit is a small library (6 kB gzipped) that adds reactive properties and tagged template
rendering on top of these native APIs. The result is a component model that works anywhere
HTML works, without a framework runtime required at delivery time.

## What Web Components Give You

### Custom Elements

Define your own HTML tags. A component defined today works in any browser, any framework, any
context — no build step required at runtime.

```ts
@customElement('my-button')
class MyButton extends LitElement {
  render() {
    return html`<button><slot></slot></button>`;
  }
}
```

Usage is plain HTML: `<my-button>Click me</my-button>`. No import. No framework context. Just the browser.

### Shadow DOM

Styles defined inside a web component don't leak out. Global styles don't leak in.
No CSS Modules, no CSS-in-JS, no `!important` fights with third-party libraries.

```ts
class MyCard extends LitElement {
  static styles = css`
    /* These rules only apply inside this component */
    :host { display: block; border-radius: 0.5rem; }
    .title { font-weight: 700; color: #ea580c; }
  `;
}
```

The browser enforces the scoping. It's not a build-time transformation — it's a runtime guarantee.

### Slots

Content projection via `<slot>` is the browser's native mechanism for composing components.
No `children` prop. No render prop. Just HTML.

```html
<!-- Component template -->
<div class="card">
  <slot name="header"></slot>
  <slot></slot>
</div>

<!-- Usage -->
<my-card>
  <h2 slot="header">Title</h2>
  <p>Card content</p>
</my-card>
```

## Standards Don't Break

<div class="callout">
<strong>The web platform has a strong commitment to backwards compatibility.</strong> APIs added
to the browser stay there. Code written against a web standard works years later, without changes.
</div>

The Custom Elements API was first shipped in Chrome in 2018. Components written to that spec
still work today — the API hasn't changed. Shadow DOM, `<slot>`, `<template>` — all stable,
all backwards compatible.

This is a property of web standards, not of any particular framework. The W3C and browser
vendors take backwards compatibility seriously because breaking the web means breaking billions
of existing pages. When you build on these APIs, you inherit that commitment.

## Interoperability

Web components work anywhere HTML works.

Use them in a Vue app. Use them in an Angular app. Use them in a static HTML file. Use them in a Next.js app (they work there too). This is not a theoretical claim — it's what happens when you write a standard.

Lit components are regular Custom Elements. The Lit library adds reactivity and template rendering, but it doesn't change what the element is at the browser level. Strip Lit out and you still have a valid custom element.

This matters for component libraries. Design system teams at Google, Adobe, and Microsoft have adopted Lit for their web component libraries because a single codebase works across all their products, regardless of which JavaScript framework those products use.

## Lit: The Right Layer

Lit adds what the native APIs lack without departing from the standard:

- **Reactive properties** — declare a property and re-renders happen automatically when it changes
- **Tagged template rendering** — `html\`...\`` is efficient, diff-based DOM updating without a virtual DOM
- **Lifecycle methods** — `connectedCallback`, `disconnectedCallback`, `updated` align with the native Custom Elements lifecycle
- **TypeScript decorators** — `@customElement`, `@property`, `@state` reduce boilerplate

The output is still a Custom Element. There's no Lit runtime in the browser sense — Lit ships as a standard JavaScript module (6 kB gzipped) that extends the native APIs.

## SSR and Declarative Shadow DOM

The historical objection to web components was SSR: Shadow DOM was client-only, which meant a flash of unstyled content on first load.

This is solved. Declarative Shadow DOM (DSD) is now supported in all major browsers. It lets you express shadow roots directly in HTML:

```html
<my-card>
  <template shadowrootmode="open">
    <style>:host { display: block; }</style>
    <div class="card"><slot></slot></div>
  </template>
  <p>Card content</p>
</my-card>
```

`@lit-labs/ssr` generates this output on the server. Litro streams it via Nitro. The client hydrates with zero layout shift.

## When Web Components Are a Good Fit

Web components shine in these situations:

- **Starting a new project** — no existing framework investment means you can choose the foundation that suits you best
- **Building a component library** — Custom Elements work in any framework, so a single library serves React, Vue, Angular, and plain HTML apps
- **Long-term maintenance** — a small team or open-source project that wants components to remain usable with minimal upkeep
- **Minimal JavaScript footprint** — Lit is 6 kB gzipped; there's no large framework runtime to ship

Web components are a point on the tradeoff curve that favors platform stability and interoperability — a foundation that stays consistent as the ecosystem around it evolves.

## Built on the Open Web

The W3C has been specifying HTML, CSS, and JavaScript APIs for over three decades. Those specifications are implemented by browser vendors who commit to keeping them working, because the web's value depends on the pages already built on it.

Custom Elements, Shadow DOM, and `<slot>` are part of that foundation. They sit alongside `<video>`, CSS Grid, and Fetch — platform features that get added and then stick around. Building your component model on these APIs means your components inherit that stability.

<div class="cta">
<a class="btn-primary" href="/docs/getting-started">Get Started with Litro</a>
<a class="btn-secondary" href="/compare/nextjs">Compare with Next.js</a>
</div>
