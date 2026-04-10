---
title: From React to FAST Element — A Component Migration Guide
description: A practical guide to migrating React components to FAST Element web components. Covers state, lifecycle, templates, observables, and the mental model shift from hooks to FAST's observable system.
date: 2026-04-10
---

# From React to FAST Element — A Component Migration Guide

This guide covers the component authoring shift from React to [FAST Element](https://www.fast.design/). If you're migrating to Litro as a full framework, read [Migrating from Next.js](/docs/migrate/from-nextjs) alongside this. FAST Element components are standard Custom Elements and work in any HTML page.

For the Lit version of this guide, see [From React to Lit](/docs/migrate/from-react).

## Quick Reference

| React | FAST Element | Notes |
|-------|-------------|-------|
| `useState` | `@observable` field | Reactive internal state |
| `useEffect(() => {...}, [])` | `connectedCallback()` | Run once on mount |
| `useEffect(() => {...}, [dep])` | `depChanged(oldVal, newVal)` | Auto-generated change handler |
| Props / JSX attributes | `@attr` decorator | Observed attributes |
| `children` prop | `<slot>` | Browser-native projection |
| `dangerouslySetInnerHTML` | Direct DOM manipulation | — |
| CSS Modules | `css` tagged template in `styles` | Shadow DOM scoping |
| JSX | `html` tagged template with arrow bindings | — |

## Function Components to Class Components

React uses function components. FAST uses classes with `define()`.

**React:**

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

**FAST Element:**

```ts
import { FASTElement, attr, html } from '@microsoft/fast-element';

class Greeting extends FASTElement {
  @attr name: string = '';
}

Greeting.define({
  name: 'my-greeting',
  template: html<Greeting>`<h1>Hello, ${x => x.name}</h1>`,
});
```

Usage: `<my-greeting name="Alice"></my-greeting>`

Note the key difference from Lit: FAST separates the template from the class definition, and uses arrow function bindings (`${x => x.name}`) instead of expression interpolation.

## State

React's `useState` maps to FAST's `@observable` decorator. Observable properties trigger template re-evaluation when changed.

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

**FAST Element:**

```ts
import { FASTElement, observable, html, css } from '@microsoft/fast-element';

class Counter extends FASTElement {
  @observable count: number = 0;
}

Counter.define({
  name: 'my-counter',
  template: html<Counter>`
    <button @click="${x => x.count++}">
      Count: ${x => x.count}
    </button>
  `,
  styles: css`
    button { padding: 0.5rem 1rem; cursor: pointer; }
  `,
});
```

## Effects and Lifecycle

React's `useEffect` maps to FAST lifecycle methods and auto-generated change handlers.

| React | FAST Element | Timing |
|-------|-------------|--------|
| `useEffect(() => {...}, [])` | `connectedCallback()` | First mount to DOM |
| `useEffect(() => {...}, [dep])` | `depChanged(oldVal, newVal)` | When `dep` changes |
| `useEffect(() => { return cleanup }, [])` | `disconnectedCallback()` | Removal from DOM |

FAST auto-generates change handler methods by convention. For a property named `count`, define a `countChanged` method:

**React:**

```tsx
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
```

**FAST Element:**

```ts
class Counter extends FASTElement {
  @observable count: number = 0;

  countChanged(oldValue: number, newValue: number) {
    document.title = `Count: ${newValue}`;
  }
}
```

## Props and Attributes

React props are function arguments. FAST uses `@attr` for HTML attributes and `@observable` for internal state.

**React:**

```tsx
function Avatar({ src, alt, size = 40 }: AvatarProps) {
  return <img src={src} alt={alt} width={size} height={size} />;
}
```

**FAST Element:**

```ts
import { FASTElement, attr, html } from '@microsoft/fast-element';

class Avatar extends FASTElement {
  @attr src: string = '';
  @attr alt: string = '';
  @attr({ converter: { fromView: Number } }) size: number = 40;
}

Avatar.define({
  name: 'my-avatar',
  template: html<Avatar>`
    <img src="${x => x.src}" alt="${x => x.alt}"
         width="${x => x.size}" height="${x => x.size}">
  `,
});
```

`@attr` properties are reflected as HTML attributes automatically. Use `@observable` for internal state that shouldn't appear in the DOM.

## Children and Slots

Same as Lit — FAST uses the browser's native `<slot>` element.

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

**FAST Element:**

```ts
class Card extends FASTElement {
  @attr title: string = '';
}

Card.define({
  name: 'my-card',
  template: html<Card>`
    <div class="card">
      <h2>${x => x.title}</h2>
      <slot></slot>
    </div>
  `,
});
```

## CSS Scoping

Like Lit, FAST uses Shadow DOM for style scoping. Styles are passed to `define()`.

**FAST Element:**

```ts
import { css } from '@microsoft/fast-element';

Counter.define({
  name: 'my-counter',
  template: html<Counter>`...`,
  styles: css`
    :host { display: block; }
    button {
      background: #ea580c;
      color: white;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
    }
  `,
});
```

## Events

React uses synthetic events. FAST uses standard DOM events with `@event` shorthand.

**React:**

```tsx
<input
  value={value}
  onChange={e => setValue(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && onSubmit(value)}
/>
```

**FAST Element:**

```ts
html<SearchInput>`
  <input
    :value="${x => x.value}"
    @input="${(x, c) => {
      x.value = (c.event.target as HTMLInputElement).value;
    }}"
    @keydown="${(x, c) => {
      if ((c.event as KeyboardEvent).key === 'Enter') {
        x.$emit('search', x.value);
      }
    }}"
  >
`
```

FAST's `$emit()` method dispatches a `CustomEvent` with `bubbles: true` and `composed: true` by default.

## Template Syntax

| React JSX | FAST `html\`...\`` |
|-----------|-------------------|
| `{variable}` | `${x => x.variable}` |
| `onClick={handler}` | `@click="${(x, c) => handler(x, c)}"` |
| `className="foo"` | `class="foo"` |
| `<Comp />` | `<my-comp></my-comp>` |
| `{condition && <el>}` | `${when(x => x.condition, html\`<el>\`)}` |
| `{arr.map(x => <li>)}` | `${repeat(x => x.arr, html\`<li>\`)}` |

FAST provides `when()` and `repeat()` directives for conditional and list rendering, which are more efficient than inline ternaries for complex cases.

## Next Steps

- [Getting Started with Litro](/docs/getting-started)
- [FAST Element Adapter guide](/docs/adapters/fast)
- [Migrating from Next.js](/docs/migrate/from-nextjs)
- [Litro vs Next.js comparison](/compare/nextjs)
