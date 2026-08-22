/** Alias entry consumed by Vite's `resolve.alias`. */
export interface LitroSourceAliasEntry {
  find: RegExp;
  replacement: string;
}

/**
 * Workspace-only aliases mapping the published Litro packages to their
 * TypeScript source. Derived from each package's own `exports` map.
 */
export declare function litroSourceAlias(): LitroSourceAliasEntry[];
export default litroSourceAlias;
