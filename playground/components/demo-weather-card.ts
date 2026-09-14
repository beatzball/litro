/**
 * <demo-weather-card city="Lisbon" .tempF=${70} summary="sunny">
 *   Rendered server-side by the demo agent's get-weather tool via ui() and
 *   streamed to the client as Declarative Shadow DOM. `weather-card-root` is
 *   a stable element id inside the shadow root — a contract with the e2e
 *   smoke check (Task 15).
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('demo-weather-card')
export class DemoWeatherCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    /*
     * Colours come from custom properties, which inherit THROUGH the shadow
     * boundary — the only way the document's theme reaches in here. The
     * fallbacks are the light palette, so the card is still readable wherever
     * nothing defines them (the agent demo, a plain page).
     *
     * Hard-coded #ccc and an inherited black used to leave this unreadable on
     * a dark host: the text was near-black on the host's dark panel.
     */
    #weather-card-root {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      border: 1px solid var(--card-border, #d0d0d0);
      border-radius: 0.5rem;
      max-width: 16rem;
      font-family: system-ui, sans-serif;
      background: var(--card-bg, #ffffff);
      color: var(--card-fg, #1a1a1a);
    }
    .city {
      font-weight: 600;
    }
    .summary {
      color: var(--card-muted, #5b5b5b);
    }
  `;

  @property({ type: String }) city = '';
  /**
   * Both OPTIONAL, and neither defaults to 0. This element is packed as a
   * data-free MCP Apps shell, and a shell that renders "32°F" before any
   * result arrives is showing a reading it does not have.
   */
  @property({ type: Number }) tempC?: number;
  /** Fahrenheit, when the caller has it — otherwise converted from `tempC`. */
  @property({ type: Number }) tempF?: number;
  @property({ type: String }) summary = '';

  /** Fahrenheit for display, or nothing at all when there is no reading yet. */
  private displayTempF(): string {
    const f = this.tempF ?? (this.tempC === undefined ? undefined : Math.round((this.tempC * 9) / 5 + 32));
    return f === undefined ? '' : `${f}\u00B0F`;
  }

  override render() {
    return html`
      <div id="weather-card-root">
        <span class="city">${this.city}</span>
        <span class="temp">${this.displayTempF()}</span>
        <span class="summary">${this.summary}</span>
      </div>
    `;
  }
}

export default DemoWeatherCard;
