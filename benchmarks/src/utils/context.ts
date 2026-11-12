import os from 'node:os';

/** BENCH_CONTEXT should describe workload categories, never identify a person or machine. */
export function sanitizeContext(value: string): string {
  const identifiers = [os.homedir(), os.hostname(), os.userInfo().username]
    .filter(value => value.length > 1)
    .sort((a, b) => b.length - a.length);
  let sanitized = value;
  for (const identifier of identifiers) sanitized = sanitized.split(identifier).join('[redacted]');
  return sanitized
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/(?:\/[\w.@~+-]+)+\/?/g, '[path]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1000);
}
