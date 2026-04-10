---
title: From React to ElenaJS — A Component Migration Guide
description: A practical guide to migrating React components to ElenaJS web components. Covers state, lifecycle, light DOM rendering, @scope CSS, and progressive enhancement.
date: 2026-04-10
---

# From React to ElenaJS — A Component Migration Guide

This guide covers the component authoring shift from React to [ElenaJS](https://elenajs.com/). Elena uses **light DOM** rendering — no Shadow DOM boundary, global CSS reaches component internals, and components upgrade via progressive enhancement instead of hydration.

For the Lit version of this guide, see [From React to Lit](/docs/migrate/from-react). For FAST, see [From React to FAST](/docs/migrate/from-react-to-fast).

## Quick Reference

| React | ElenaJS | Notes |
|-------|---------|-------|
| `useState` | Static `props` + reactive fields | Internal state |
| `useEffect(() => {...}, [])` | `connectedCallback()` | Run once on mount |
| `useEffect(() => {...}, [dep])` | `willUpdate()` | Called before render |
| Props / JSX attributes | Static `props` array | Observed attributes (must be lowercase) |
| `children` prop | `this.innerHTML` | Direct DOM access |
| `dangerouslySetInnerHTML` | `unsafeHTML()` from `@elenajs/core` | — |
| CSS Modules | `@scope` CSS | Light DOM encapsulation |
| JSX | `html` tagged template | — |

## Function Components to Class Components

React uses function components. Elena uses a class mixin with a static `tagName` and `define()`.

**React:**

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

**ElenaJS:**

```ts
import { html, Component } from '@elenajs/core';

class Greeting extends Component(HTMLElement) {
  static tagName = 'my-greeting';
  static props = ['name'];

  name = '';

  render() {
    return html`<h1>Hello, ${this.name}</h1>`;
  }
}

Greeting.define();
```

Usage: `<my-greeting name="Alice"></my-greeting>`

Key difference: Elena's `html` tag uses standard template literal interpolation (`${this.name}`), not arrow bindings (Lit) or arrow functions (FAST).

## State

React's `useState` maps to Elena reactive properties declared in the static `props` array.

**React:**

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

**ElenaJS:**

```ts
import { html, Component } from '@elenajs/core';

class Counter extends Component(HTMLElement) {
  static tagName = 'my-counter';
  static props = ['count'];

  count = 0;

  render() {
    return html`
      <button @click="${() => { this.count++; this.requestUpdate(); }}">
        Count: ${this.count}
      </button>
    `;
  }
}

Counter.define();
```

## Props and Attributes

Elena props are declared in a static `props` array. **Props must be lowercase** — HTML parsers lowercase attribute names, so camelCase breaks attribute binding.

**React:**

```tsx
function Avatar({ src, alt, size = 40 }: AvatarProps) {
  return <img src={src} alt={alt} width={size} height={size} />;
}
```

**ElenaJS:**

```ts
class Avatar extends Component(HTMLElement) {
  static tagName = 'my-avatar';
  static props = ['src', 'alt', 'size'];

  src = '';
  alt = '';
  size = 40;

  render() {
    return html`
      <img src="${this.src}" alt="${this.alt}"
           width="${this.size}" height="${this.size}">
    `;
  }
}

Avatar.define();
```

## Children

React uses the `children` prop. Elena uses light DOM — child content is directly accessible via `this.innerHTML` or `this.children`.

**React:**

```tsx
function Card({ children, title }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

**ElenaJS:**

```ts
import { html, unsafeHTML, Component } from '@elenajs/core';

class Card extends Component(HTMLElement) {
  static tagName = 'my-card';
  static props = ['title'];

  title = '';

  render() {
    return html`
      <div class="card">
        <h2>${this.title}</h2>
        ${unsafeHTML(this.innerHTML)}
      </div>
    `;
  }
}

Card.define();
```

Note: since Elena uses light DOM, there are no `<slot>` elements. Child content is accessed directly.

## CSS Scoping with @scope

React uses CSS Modules for scoping. Elena uses the CSS `@scope` at-rule — styles are written in a global stylesheet but scoped to the component.

**React:**

```tsx
import styles from './Button.module.css';

export function Button({ children }) {
  return <button className={styles.btn}>{children}</button>;
}
```

**ElenaJS (in global CSS):**

```css
@scope (my-button) {
  :scope {
    display: inline-block;
  }
  button {
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 0.375rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
  button:hover {
    background: #c2410c;
  }
}
```

`@scope` is supported in Chrome 118+, Edge 118+, and Safari 17.4+. In older browsers, styles apply globally (graceful degradation).

## Events

Same standard DOM events as Lit and FAST, but since Elena renders into the light DOM, events don't need `composed: true` to cross boundaries.

**React:**

```tsx
<input
  value={value}
  onChange={e => setValue(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && onSubmit(value)}
/>
```

**ElenaJS:**

```ts
render() {
  return html`
    <input
      .value="${this.value}"
      @input="${(e: InputEvent) => {
        this.value = (e.target as HTMLInputElement).value;
      }}"
      @keydown="${(e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.dispatchEvent(new CustomEvent('search', {
            detail: this.value,
            bubbles: true,
          }));
        }
      }}"
    >
  `;
}
```

No `composed: true` needed — light DOM events bubble naturally through the document.

## Template Syntax

| React JSX | Elena `html\`...\`` |
|-----------|-------------------|
| `{variable}` | `${this.variable}` |
| `onClick={handler}` | `@click="${handler}"` |
| `className="foo"` | `class="foo"` |
| `<Comp />` | `<my-comp></my-comp>` |
| `{condition && <el>}` | `${condition ? html\`<el>\` : ''}` |
| `{arr.map(x => <li>)}` | `${arr.map(x => html\`<li>\`)}` |

## Why Light DOM?

Elena's light DOM approach offers several advantages over Shadow DOM for content-focused sites:

- **Global CSS works** — your existing stylesheets, utility classes, and CSS frameworks reach component internals
- **Smaller HTML** — no `<template shadowrootmode="open">` wrappers in SSR output
- **No hydration** — components upgrade in place via progressive enhancement, reducing JavaScript complexity
- **Better SEO accessibility** — content is directly in the document, not behind shadow boundaries
- **Simpler debugging** — DevTools shows the real DOM, no shadow root nesting

The trade-off is that you need `@scope` CSS for encapsulation instead of getting it automatically from Shadow DOM.

## Next Steps

- [Getting Started with Litro](/docs/getting-started)
- [ElenaJS Adapter guide](/docs/adapters/elena)
- [Migrating from Next.js](/docs/migrate/from-nextjs)
- [Litro vs Next.js comparison](/compare/nextjs)
