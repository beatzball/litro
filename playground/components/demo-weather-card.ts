/**
 * <demo-weather-card city="Lisbon" .tempC=${21} summary="sunny">
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
    #weather-card-root {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      border: 1px solid #ccc;
      border-radius: 0.5rem;
      max-width: 16rem;
      font-family: system-ui, sans-serif;
    }
    .city {
      font-weight: 600;
    }
  `;

  @property({ type: String }) city = '';
  @property({ type: Number }) tempC = 0;
  @property({ type: String }) summary = '';

  override render() {
    return html`
      <div id="weather-card-root">
        <span class="city">${this.city}</span>
        <span class="temp">${this.tempC}&deg;C</span>
        <span class="summary">${this.summary}</span>
      </div>
    `;
  }
}

export default DemoWeatherCard;
