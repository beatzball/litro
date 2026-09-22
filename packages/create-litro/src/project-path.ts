/**
 * project-path.ts — turning what the user typed into a directory and a name.
 *
 * The argument is a PATH, and it was being treated as a bare name:
 * `join(process.cwd(), projectName)` concatenates an absolute second argument
 * instead of replacing the first, so `create-litro /tmp/demo/my-app` wrote a
 * whole `./tmp/demo/my-app` tree inside the current directory and printed the
 * usual success block. `resolve` is the function that honors an absolute path.
 *
 * The path also has a second job: `{{projectName}}` is interpolated into
 * `package.json`'s `name`, into site titles and into install commands. A path
 * cannot serve as either of those, so the two are separated here — `dir` is
 * where the files go, `name` is what the project is called.
 *
 * No external dependencies — uses Node.js built-ins only.
 */
import { basename, isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface ProjectPath {
  /** Absolute directory the project is written to. */
  dir: string;
  /**
   * The project's name: the last segment of the path, and nothing else.
   *
   * `package.json`'s `name` cannot hold a path, so `/tmp/demo/my-app` names a
   * project `my-app`. For the ordinary `create-litro my-app` this is the
   * argument unchanged, which is what it has always been.
   */
  name: string;
  /**
   * The path to print back to the user, as they typed it — so `cd <display>`
   * is a command they can run. A leading `~` is shown expanded, because a
   * silent expansion is the thing worth showing.
   */
  display: string;
}

/**
 * Resolve the project argument into a directory, a name and something to print.
 *
 * @param input  The path as typed: relative, absolute, or `~`-prefixed.
 * @param cwd    The directory a relative path is resolved against.
 *
 * @throws When the path cannot be used — a `~user` form this cannot expand, or
 *         a path with no last segment to name the project after.
 */
export function resolveProjectPath(input: string, cwd: string = process.cwd()): ProjectPath {
  const trimmed = input.trim();

  if (trimmed === '') {
    throw new Error('No project path given. Pass a directory name, or a full path.');
  }

  // A shell expands `~` before the CLI ever sees it, so a literal one arrives
  // only when it was quoted — and the user still meant their home directory.
  // Creating a directory actually called `~` is the trap this avoids: it is
  // invisible in `ls` output and awkward to delete.
  let expanded = trimmed;
  let tildeExpanded = false;
  if (trimmed === '~' || trimmed.startsWith('~/')) {
    expanded = resolve(homedir(), trimmed.slice(1).replace(/^\/+/, ''));
    tildeExpanded = true;
  } else if (trimmed.startsWith('~')) {
    // `~someone/sites` names another user's home. Guessing at it would be
    // wrong more often than right, so refuse rather than write a directory
    // literally called `~someone`.
    throw new Error(
      `Cannot expand '${trimmed.split('/')[0]}' — only '~' for your own home directory is understood. ` +
        `Give the full path instead.`,
    );
  }

  const dir = resolve(cwd, expanded);
  const name = basename(dir);

  if (name === '') {
    throw new Error(
      `'${trimmed}' has no directory name to scaffold into. ` +
        `Give a path that ends in the name of the project.`,
    );
  }

  // An absolute path, and a relative one, are both printed back exactly as
  // typed, so `cd <display>` works either way. Only the tilde form differs,
  // and only because the user should see what it became.
  const display = tildeExpanded ? dir : trimmed;

  return { dir, name, display };
}

/** Resolve a directory argument such as `--for-repo`, honoring a leading `~`. */
export function resolveUserPath(input: string, cwd: string = process.cwd()): string {
  const trimmed = input.trim();
  if (trimmed === '~' || trimmed.startsWith('~/')) {
    return resolve(homedir(), trimmed.slice(1).replace(/^\/+/, ''));
  }
  if (trimmed.startsWith('~')) {
    throw new Error(
      `Cannot expand '${trimmed.split('/')[0]}' — only '~' for your own home directory is understood. ` +
        `Give the full path instead.`,
    );
  }
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);
}
