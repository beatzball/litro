/**
 * Progressive-enhancement form client. BROWSER-ONLY, framework-agnostic:
 * one delegated submit listener upgrades any <form action="/__litro/action/...">
 * to a seroval RPC and reports the outcome via CustomEvents on the form
 * (litro:action-success / litro:action-error, both bubbling and composed).
 * Without this module (or without JS at all) the same form posts natively
 * and the server answers with the PRG flow.
 *
 * NOTE: 'submit' events are composed:false — they never cross shadow-root
 * boundaries. enhanceForms() on document covers light-DOM forms; components
 * that render forms inside shadow roots call enhanceForms(this.renderRoot).
 * enhanceForms is idempotent per root — calling it multiple times on the same
 * root is safe and will not duplicate listeners.
 */
import { callAction } from './client.js';
import { formDataToObject } from './form-data.js';

const ACTION_PATH_RE = /^\/__litro\/action\/([0-9a-f]{12})$/;
const enhancedRoots = new WeakSet<EventTarget>();

export function enhanceForms(root: Document | ShadowRoot | Element = document): () => void {
  if (enhancedRoots.has(root)) {
    return () => {};
  }
  enhancedRoots.add(root);
  const listener = (e: Event): void => {
    onSubmit(e);
  };
  root.addEventListener('submit', listener);
  return () => {
    root.removeEventListener('submit', listener);
    enhancedRoots.delete(root);
  };
}

function onSubmit(e: Event): void {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  const action = form.getAttribute('action') ?? '';
  const path = action.startsWith('/') ? action.split('?')[0] : new URL(action, location.href).pathname;
  const match = ACTION_PATH_RE.exec(path);
  if (!match) return;
  e.preventDefault();
  // formDataToObject strips the _litro_csrf token field — the header gate
  // covers the enhanced path, and a strict schema would reject the extra key.
  const input = formDataToObject(new FormData(form));
  void submitViaRpc(form, match[1], input);
}

async function submitViaRpc(
  form: HTMLFormElement,
  id: string,
  input: Record<string, unknown>,
): Promise<void> {
  try {
    const result = await callAction(id, [input]);
    form.dispatchEvent(
      new CustomEvent('litro:action-success', { detail: result, bubbles: true, composed: true }),
    );
  } catch (err) {
    form.dispatchEvent(
      new CustomEvent('litro:action-error', { detail: err, bubbles: true, composed: true }),
    );
  }
}
