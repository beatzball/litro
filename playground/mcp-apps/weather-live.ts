/**
 * The third shape: a web component that is actually ALIVE in the iframe.
 *
 * `weather-card` ships the same Lit component and is INERT. SSR sends the
 * element's rendered output — a `<template shadowrootmode="open">` the parser
 * adopts — but not its class, so setting `.city` on it assigns a property
 * nothing is watching. That is why it needs a custom `apply` that reaches into
 * the shadow root and writes text by hand.
 *
 * This one inlines a `runtime` that DEFINES the element. Because
 * `customElements.define()` upgrades any matching tag already in the document,
 * the class takes over the shadow root SSR already painted — first paint is
 * still server-rendered, and from then on property assignment re-renders.
 *
 * So the default `apply` works here, and there is no hand-written fill step.
 *
 * THE COST IS THE POINT. Self-containment means every document carries its own
 * copy of whatever it uses; nothing is shared between them. This runtime is
 * hand-written and about a kilobyte. Inlining Lit and its hydration support
 * instead would be tens of kilobytes, in this document and in every other one
 * that wanted a live component — which is why neither of the other two demos
 * does it.
 */
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';
import { html } from 'lit';
import { DemoWeatherCard } from '../components/demo-weather-card.js';

void DemoWeatherCard; // named import + void: bare side-effect imports get tree-shaken

export default defineMcpApp({
  // No `uri`: the packer derives it, so this is ui://playground/weather-live.
  title: 'Weather, live component',

  // Server-rendered by Lit, exactly as in `weather-card` — the shell paints
  // from the first byte whether or not the runtime below ever arrives.
  shell: html`<demo-weather-card city="—" summary="Waiting for the forecast…"></demo-weather-card>`,

  styles: `
    :root {
      color-scheme: light dark;
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme='light']) {
        --card-bg: #1f1f1f;
        --card-fg: #ededed;
        --card-muted: #a9a9a9;
        --card-border: #414141;
      }
    }
    :root[data-theme='dark'] {
      --card-bg: #1f1f1f;
      --card-fg: #ededed;
      --card-muted: #a9a9a9;
      --card-border: #414141;
    }
    :root[data-theme='light'] {
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
    }
    body { margin: 0; padding: 8px; background: transparent; color: var(--card-fg); }
  `,

  /*
   * The element's definition, hand-written and inlined.
   *
   * It never renders the shadow root itself — SSR already did. It ADOPTS the
   * one that is there and updates text nodes when a property changes, which is
   * what makes this a live component rather than static markup.
   */
  runtime: `
    (function () {
      var FIELDS = ['city', 'tempC', 'tempF', 'summary'];

      function LiveWeatherCard() {
        return Reflect.construct(HTMLElement, [], LiveWeatherCard);
      }
      LiveWeatherCard.prototype = Object.create(HTMLElement.prototype);
      LiveWeatherCard.prototype.constructor = LiveWeatherCard;
      Object.setPrototypeOf(LiveWeatherCard, HTMLElement);

      LiveWeatherCard.prototype.connectedCallback = function () {
        // SSR already attached this via declarative shadow DOM. If it is
        // missing the browser did not support DSD, so make one rather than
        // rendering nothing.
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

        // DELIBERATELY NO RENDER HERE. Upgrade happens before any result
        // arrives, so every field is undefined — rendering now would blank the
        // server-painted shell, which is the one thing this document exists to
        // deliver. The first render is the first property assignment.
      };

      LiveWeatherCard.prototype._render = function () {
        var root = this.shadowRoot;
        if (!root) return;
        var set = function (sel, value) {
          var n = root.querySelector(sel);
          if (n) n.textContent = value;
        };
        set('.city', this.city == null ? '' : String(this.city));
        var f = this.tempF;
        if (f == null && this.tempC != null) f = Math.round((this.tempC * 9) / 5 + 32);
        set('.temp', f == null ? '' : f + '\\u00B0F');
        set('.summary', this.summary == null ? '' : String(this.summary));
      };

      // A real accessor per field. THIS is the difference from the inert card:
      // an assignment lands on a setter that re-renders, so the bridge's
      // default Object.assign is enough and no custom apply is needed.
      FIELDS.forEach(function (name) {
        var slot = '_' + name;
        Object.defineProperty(LiveWeatherCard.prototype, name, {
          get: function () {
            return this[slot];
          },
          set: function (value) {
            this[slot] = value;
            this._render();
          },
          configurable: true,
          enumerable: true,
        });
      });

      // Upgrades the tag SSR already painted, shadow root and all.
      if (!customElements.get('demo-weather-card')) {
        customElements.define('demo-weather-card', LiveWeatherCard);
      }
    })();
  `,

  // NO `apply`. The default is a guarded property assignment, and with a live
  // element that is all it takes — which is the whole point of this demo.
  prefersBorder: true,
});
