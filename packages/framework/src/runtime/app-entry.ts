/**
 * app-entry.ts — the URL the page shell loads the client entry from.
 *
 * `/_litro/app.js` has the same name in every build. A browser that kept an
 * old copy keeps running the old app after a deploy, and that app asks for
 * hashed chunks the new build no longer has, so client-side navigation
 * silently does nothing. The production URL therefore carries the entry's
 * content hash as `?v=<hash>`: each deploy's HTML names a URL that no browser
 * has cached yet.
 *
 * The hash is computed at build time, after `vite build`, by the pages plugin
 * (`plugins/app-version.ts`). The generated page manifest assigns it to
 * `globalThis[LITRO_APP_VERSION_GLOBAL]`, and every page handler imports the
 * manifest, so it is set before the first request is served. No hash (unit
 * tests, `litro dev`, an app built without a client bundle) means the bare
 * `/_litro/app.js`.
 */

/** The global the generated page manifest assigns the entry version to. */
export const LITRO_APP_VERSION_GLOBAL = '__litro_app_version__';

/**
 * A production entry URL in place of `/_litro/app.js?v=<version>`. A string
 * is used exactly as given, with no version added. A function receives the
 * build's entry version (undefined when none is known) and returns the URL,
 * so a URL elsewhere can still change with each deploy.
 */
export type AppScriptUrl = string | ((version: string | undefined) => string);

export interface AppEntryUrlOptions {
  /** `LITRO_BASE_PATH`, without a trailing slash. */
  basePath: string;
  /** True under `litro dev` (`LITRO_DEV=true`), with either dev middleware. */
  isDev: boolean;
  /** True under `litro dev` with the live-source entry (see `runtime/vite-dev.ts`). */
  liveEntry: boolean;
  /** `createPageHandler({ appScriptUrl })`. Production only. */
  override?: AppScriptUrl;
  /** The entry version. Defaults to the value the page manifest assigned. */
  version?: string;
}

/** Reads the entry version the generated page manifest assigned, if any. */
export function getAppVersion(): string | undefined {
  const v = (globalThis as Record<string, unknown>)[LITRO_APP_VERSION_GLOBAL];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/**
 * Returns the client entry URL for the page shell.
 *
 * - Dev live entry: `${basePath}/app.ts`, served by Vite as live source.
 * - Dev with an older middleware: the bare `${basePath}/_litro/app.js`. No
 *   version is computed in dev, and the override is a production setting.
 * - Production with an override: a string as given, or the function's result
 *   for this build's version.
 * - Production: `${basePath}/_litro/app.js?v=<version>`, or without the query
 *   when no version is known.
 */
export function appEntryUrl(options: AppEntryUrlOptions): string {
  const { basePath, isDev, liveEntry, override } = options;
  if (liveEntry) return `${basePath}/app.ts`;
  const url = `${basePath}/_litro/app.js`;
  if (isDev) return url;
  const version = options.version ?? getAppVersion();
  if (typeof override === 'function') return override(version);
  if (override) return override;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
