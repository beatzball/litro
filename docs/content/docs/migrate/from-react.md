---
title: From React to Lit — A Component Migration Guide
description: A practical guide to migrating React components to Lit web components. Covers state, lifecycle, props, slots, context, CSS scoping, and the mental model shift from function components to class components.
date: 2026-03-21
---

# From React to Lit — A Component Migration Guide

This guide covers the component authoring shift from React to Lit. If you're migrating to Litro as a full framework, read [Migrating from Next.js](/docs/migrate/from-nextjs) alongside this. If you're adopting Lit gradually within an existing app, this guide works standalone — Lit components are standard Custom Elements and drop into any HTML page.

## Quick Reference

| React | Lit | Notes |
|-------|-----|-------|
| `useState` | `static properties = { _field: { state: true } }` | Reactive internal state |
| `useEffect(() => {...}, [])` | `connectedCallback()` | Run once on mount |
| `useEffect(() => {...}, [dep])` | `updated(changedProperties)` | Run when dep changes |
| Props / JSX attributes | `static override properties = { name: { type: String } }` | Observed attributes |
| `children` prop | `<slot>` | Browser-native projection |
| Context | `@lit/context` controller | Provider/consumer pattern |
| `dangerouslySetInnerHTML` | `unsafeHTML()` from `lit/directives/` | — |
| CSS Modules | `static styles = css\`...\`` | Shadow DOM scoping |
| `React.memo` | N/A — Lit batches updates automatically | Built-in |
| JSX | Tagged template literals (`html\`...\``) | — |

## Function Components → Class Components

React uses function components. Lit uses classes extending `LitElement`.

**React:**

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

**Lit:**

```ts
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-greeting')
class Greeting extends LitElement {
  static override properties = {
    name: { type: String },
  };

  name = '';

  override render() {
    return html`<h1>Hello, ${this.name}</h1>`;
  }
}
```

Usage: `<my-greeting name="Alice"></my-greeting>`

Custom element names must contain a hyphen — this is a browser requirement that prevents collisions with future HTML elements.

## State

React's `useState` maps to Lit reactive properties with `state: true`. State properties trigger re-renders when changed, but are not reflected as HTML attributes.

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

**Lit:**

```ts
@customElement('my-counter')
class Counter extends LitElement {
  static override properties = {
    _count: { state: true },
  };

  _count = 0;

  override render() {
    return html`
      <button @click=${() => this._count++}>
        Count: ${this._count}
      </button>
    `;
  }
}
```

Convention: prefix internal state properties with `_` to indicate they're not public attributes.

## Effects and Lifecycle

React's `useEffect` maps to Lit lifecycle methods.

| React | Lit | Timing |
|-------|-----|--------|
| `useEffect(() => {...}, [])` | `connectedCallback()` | First mount to DOM |
| `useEffect(() => {...}, [dep])` | `updated(changedProperties)` | After each render where dep changed |
| `useEffect(() => { return cleanup }, [])` | `disconnectedCallback()` | Removal from DOM |

**React:**

```tsx
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
```

**Lit:**

```ts
override updated(changed: Map<string, unknown>) {
  if (changed.has('_count')) {
    document.title = `Count: ${this._count}`;
  }
}
```

## Props

React props are function arguments. Lit properties are declared in `static override properties` and accessed via `this`.

**React:**

```tsx
interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
}

function Avatar({ src, alt, size = 40 }: AvatarProps) {
  return <img src={src} alt={alt} width={size} height={size} />;
}
```

**Lit:**

```ts
@customElement('my-avatar')
class Avatar extends LitElement {
  static override properties = {
    src: { type: String },
    alt: { type: String },
    size: { type: Number },
  };

  src = '';
  alt = '';
  size = 40;

  override render() {
    return html`
      <img src="${this.src}" alt="${this.alt}"
           width="${this.size}" height="${this.size}">
    `;
  }
}
```

Properties declared with `type: String/Number/Boolean` are automatically reflected from HTML attributes. `<my-avatar src="/photo.jpg" size="64">` sets `this.src` and `this.size`.

## Children and Slots

React uses `children` prop. Lit uses the browser's native `<slot>` element.

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

// Usage:
<Card title="My Card">
  <p>Content here</p>
</Card>
```

**Lit:**

```ts
@customElement('my-card')
class Card extends LitElement {
  static override properties = { title: { type: String } };
  title = '';

  override render() {
    return html`
      <div class="card">
        <h2>${this.title}</h2>
        <slot></slot>
      </div>
    `;
  }
}

// Usage:
// <my-card title="My Card"><p>Content here</p></my-card>
```

Named slots work like slot props:

```ts
// Component template:
html`
  <div>
    <slot name="header"></slot>
    <slot></slot>
    <slot name="footer"></slot>
  </div>
`

// Usage:
// <my-layout>
//   <h1 slot="header">Title</h1>
//   <p>Main content</p>
//   <p slot="footer">Footer text</p>
// </my-layout>
```

## CSS Scoping

CSS Modules in React prevent global style collisions. Lit uses Shadow DOM — styles in `static styles` are scoped to the component automatically.

**React:**

```tsx
import styles from './Button.module.css';

export function Button({ children }) {
  return <button className={styles.btn}>{children}</button>;
}
```

**Lit:**

```ts
import { css, html, LitElement } from 'lit';

class Button extends LitElement {
  static styles = css`
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
  `;

  render() {
    return html`<button><slot></slot></button>`;
  }
}
```

No class name collisions. No CSS-in-JS runtime. Shadow DOM's scoping is enforced by the browser.

## Events

React uses synthetic events. Lit uses standard DOM events with `@event` shorthand in templates.

**React:**

```tsx
function SearchInput({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSubmit(value)}
    />
  );
}
```

**Lit:**

```ts
@customElement('my-search')
class SearchInput extends LitElement {
  static override properties = { _value: { state: true } };
  _value = '';

  override render() {
    return html`
      <input
        .value="${this._value}"
        @input="${(e: InputEvent) => {
          this._value = (e.target as HTMLInputElement).value;
        }}"
        @keydown="${(e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            this.dispatchEvent(new CustomEvent('search', {
              detail: this._value,
              bubbles: true,
              composed: true,
            }));
          }
        }}"
      >
    `;
  }
}
```

The `.value` binding (note the dot prefix) sets the DOM property rather than the HTML attribute, ensuring the input stays controlled. `composed: true` on the CustomEvent allows it to bubble out of the shadow root.

## Context

React Context maps to Lit's `@lit/context` controller, which uses a typed provider/consumer pattern.

```ts
import { createContext, provide, consume } from '@lit/context';

// Define the context key
const themeContext = createContext<'light' | 'dark'>('theme');

// Provider
class ThemeProvider extends LitElement {
  @provide({ context: themeContext })
  theme: 'light' | 'dark' = 'light';
}

// Consumer
class ThemedButton extends LitElement {
  @consume({ context: themeContext, subscribe: true })
  theme: 'light' | 'dark' = 'light';

  render() {
    return html`<button data-theme="${this.theme}"><slot></slot></button>`;
  }
}
```

`subscribe: true` re-renders the consumer when the context value changes, equivalent to React's `useContext` re-render.

## Template Syntax

React uses JSX. Lit uses tagged template literals.

| React JSX | Lit `html\`...\`` |
|-----------|-----------------|
| `{variable}` | `${variable}` |
| `onClick={handler}` | `@click=${handler}` |
| `className="foo"` | `class="foo"` |
| `style={{ color: 'red' }}` | `style="color:red"` |
| `.property={value}` | `.property=${value}` |
| `<Comp />` | `<my-comp></my-comp>` |
| `{condition && <el>}` | `${condition ? html\`<el>\` : ''}` |
| `{arr.map(x => <li>)}` | `${arr.map(x => html\`<li>\`)}` |

Note the `.property` binding syntax for setting DOM properties vs HTML attributes — this is important for inputs (`.value`), boolean properties (`.disabled`), and passing objects/arrays.

## Next Steps

- [Getting Started with Litro](/docs/getting-started)
- [Migrating from Next.js](/docs/migrate/from-nextjs)
- [Litro vs Next.js comparison](/compare/nextjs)
