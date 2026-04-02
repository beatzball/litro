import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <preview-banner>
 *   Fixed bottom banner indicating preview/draft mode is active.
 *   Renders an exit link that clears the preview cookie.
 */
@customElement('preview-banner')
export class PreviewBanner extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 200;
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.6rem 1rem;
      background: var(--sl-color-accent, #ea580c);
      color: #fff;
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 600;
    }

    .exit-link {
      color: #fff;
      text-decoration: underline;
      font-weight: 400;
    }

    .exit-link:hover {
      opacity: 0.85;
    }
  `;

  override render() {
    return html`
      <div class="banner" role="status">
        <span>Preview Mode — Draft content visible</span>
        <a class="exit-link" href="?preview=0">Exit preview</a>
      </div>
    `;
  }
}

export default PreviewBanner;
