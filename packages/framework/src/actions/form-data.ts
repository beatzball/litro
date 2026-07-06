/**
 * FormData → action-input conversion. ISOMORPHIC — used by both the browser
 * form enhancer and the server form-mode handler; keep free of Node imports.
 * Repeated field names collapse into arrays; File values pass through
 * (seroval serializes Blobs on the enhanced path; the no-JS path receives
 * them from readFormData directly). The CSRF token field is stripped on both
 * paths — it is transport metadata, and a strict input schema would
 * otherwise reject it as an unknown key.
 */
export const CSRF_FIELD = '_litro_csrf';

export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key === CSRF_FIELD) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}
