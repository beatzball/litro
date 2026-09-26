/**
 * Reads what `litro mcp-app build` wrote, and nothing else.
 *
 * The bytes are passed through untouched, both here and at `resources/read`.
 * Reshaping a descriptor's `_meta` on the way out would mean a host is checking
 * THIS file's reading of the MCP Apps spec rather than the packager's, which is
 * exactly the mistake AGENT-012 records. The packager pins the spec version; a
 * server that re-derives anything can disagree with it silently.
 *
 * Nothing here accepts a uri from a request. Addresses come from the manifest,
 * and `resources/read` looks a request's uri up in that map or refuses it, so
 * no request can name a file (AGENT-008).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';

/** Where `litro mcp-app build` writes by default. */
export const DEFAULT_APPS_DIR = 'dist/mcp-apps';

export const MANIFEST_FILE = 'manifest.json';

/** One entry of the packer's `manifest.json`. */
interface ManifestEntry {
  name: string;
  uri: string;
  html: string;
  descriptor: string;
}

/**
 * A packed app's resource descriptor, as the packager wrote it. Deliberately
 * loose: only the fields this server reads are named, and `_meta` travels
 * whole.
 */
export interface PackedAppDescriptor {
  uri: string;
  name: string;
  mimeType: string;
  _meta?: Record<string, unknown>;
}

export interface PackedApp {
  /** The manifest entry name — the output path stem, which is what a tool's
   *  `app` field names. */
  name: string;
  descriptor: PackedAppDescriptor;
  /** The document, byte for byte as the build wrote it. */
  html: string;
}

export interface LoadedApps {
  apps: PackedApp[];
  /** Resolved `manifest.json` path, for messages. */
  manifestPath: string;
  /** True when there is no manifest at all — a project that has not run
   *  `litro mcp-app build`, which is not an error until a tool names an app. */
  missing: boolean;
}

/**
 * Loads every app the manifest lists.
 *
 * A MISSING manifest is not a failure. A project may have tools and no apps at
 * all, and `litro mcp serve` must still serve those tools; the caller decides
 * whether the absence matters, which it does only when a tool names an app.
 *
 * A manifest that exists but does not parse, or that points at a document that
 * is not there, IS a failure: the build wrote a broken set, and serving half of
 * it would show a host a resource list with a hole in it.
 */
export async function loadPackedApps(appsDir: string): Promise<LoadedApps> {
  const manifestPath = join(appsDir, MANIFEST_FILE);

  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch {
    return { apps: [], manifestPath, missing: true };
  }

  let manifest: ManifestEntry[];
  try {
    manifest = JSON.parse(raw) as ManifestEntry[];
  } catch (err) {
    throw new Error(
      `${manifestPath} is not valid JSON (${(err as Error).message}). Re-run \`litro mcp-app build\`.`,
    );
  }
  if (!Array.isArray(manifest)) {
    throw new Error(`${manifestPath} should be an array of app entries. Re-run \`litro mcp-app build\`.`);
  }

  const apps = await Promise.all(
    manifest.map(async (entry) => {
      const htmlPath = join(appsDir, entry.html);
      const descriptorPath = join(appsDir, entry.descriptor);
      let html: string;
      let descriptor: PackedAppDescriptor;
      try {
        html = await readFile(htmlPath, 'utf8');
      } catch {
        throw new Error(
          `${manifestPath} lists app "${entry.name}" but ${htmlPath} is missing. Re-run \`litro mcp-app build\`.`,
        );
      }
      try {
        descriptor = JSON.parse(await readFile(descriptorPath, 'utf8')) as PackedAppDescriptor;
      } catch {
        throw new Error(
          `${manifestPath} lists app "${entry.name}" but ${descriptorPath} is missing or unreadable. ` +
            'Re-run `litro mcp-app build`.',
        );
      }
      return { name: entry.name, descriptor, html };
    }),
  );

  return { apps, manifestPath, missing: false };
}

/**
 * Resolves what a tool's `app` field names to a packed app.
 *
 * Two forms, and the order matters. A literal `ui://` address is matched
 * against the descriptors' addresses; anything else is a manifest entry name.
 * Neither form ever becomes a file path.
 */
export function resolveApp(apps: PackedApp[], nameOrUri: string): PackedApp | undefined {
  if (nameOrUri.startsWith('ui://')) return apps.find((a) => a.descriptor.uri === nameOrUri);
  return apps.find((a) => a.name === nameOrUri);
}
