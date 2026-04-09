/**
 * Type declarations for Elena packages that lack shipped types.
 *
 * @elenajs/core and @elenajs/ssr are RC packages that may not include
 * complete TypeScript declarations. These ambient declarations provide
 * enough type information for the adapter implementation.
 */

declare module '@elenajs/core' {
  type Constructor<T = HTMLElement> = new (...args: any[]) => T;

  interface ElenaComponent extends HTMLElement {
    /** Built-in reactive property that captures text content placed inside
     *  the element before hydration. */
    text: string;
    connectedCallback?(): void;
    disconnectedCallback?(): void;
    render?(): unknown;
  }

  interface ElenaClass<T extends HTMLElement = HTMLElement> {
    new (...args: any[]): T & ElenaComponent;
    tagName?: string;
    props?: string[];
    define(): void;
  }

  /**
   * Elena mixin — wraps a base HTMLElement class to add reactive props,
   * progressive enhancement, and optional render().
   */
  export function Elena<T extends Constructor>(base: T): T & ElenaClass;

  /**
   * Tagged template literal for HTML. Auto-escapes interpolated values.
   * Nested html fragments pass through without double-escaping.
   */
  export function html(strings: TemplateStringsArray, ...values: unknown[]): unknown;
}

declare module '@elenajs/ssr' {
  type Constructor = new (...args: any[]) => HTMLElement;

  /**
   * Register component classes for SSR expansion.
   * Must be called before ssr() for each custom element.
   */
  export function register(...components: Constructor[]): void;

  /**
   * Remove previously registered components from the SSR registry.
   */
  export function unregister(...components: Constructor[]): void;

  /**
   * Remove all registered components.
   */
  export function clear(): void;

  /**
   * Render HTML string, expanding registered Elena components.
   * Returns the expanded HTML string synchronously.
   */
  export function ssr(html: string): string;
}
