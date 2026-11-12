import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';
import type { ExecResult } from '@beatzball/sandpiper';

@customElement('run-output')
export class RunOutput extends LitElement {
  static override styles = [pageReset, css`
    :host { display: block; font-family: system-ui, sans-serif; }
    section { padding: 1rem; border: 1px solid var(--card-border, #888); border-radius: .5rem; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 28rem; overflow: auto; }
    h3 { font-size: 1rem; }
  `];

  @property({ attribute: false }) cmd: string[] = [];
  @property({ attribute: false }) result?: ExecResult;

  override render() {
    const r = this.result;
    return html`<section aria-label="Command result">
      <h2>Run output</h2>
      <pre aria-label="Command">${JSON.stringify(this.cmd)}</pre>
      ${r ? html`
        <p role="status">${r.timedOut ? 'Timed out' : `Exit code: ${r.exitCode ?? 'unavailable'}`}</p>
        <h3>Standard output</h3><pre id="stdout">${r.stdout}</pre>
        <h3>Standard error</h3><pre id="stderr">${r.stderr}</pre>
        ${r.stdoutTruncated || r.stderrTruncated ? html`<p>Output was truncated by the machine.</p>` : ''}
      ` : ''}
    </section>`;
  }
}
