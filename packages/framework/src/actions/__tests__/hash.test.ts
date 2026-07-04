import { describe, it, expect } from 'vitest';
import { hashActionId, normalizeActionPath } from '../hash.js';

describe('normalizeActionPath', () => {
  it('makes the path root-relative, posix, and strips the extension', () => {
    expect(normalizeActionPath('/proj', '/proj/posts/posts.server.ts')).toBe('posts/posts.server');
    expect(normalizeActionPath('/proj', '/proj/a/b.server.tsx')).toBe('a/b.server');
    expect(normalizeActionPath('/proj', '/proj/a/b.server.js')).toBe('a/b.server');
    expect(normalizeActionPath('/proj', '/proj/a/b.server.mjs')).toBe('a/b.server');
  });

  it('strips Vite query suffixes before hashing input', () => {
    expect(normalizeActionPath('/proj', '/proj/x.server.ts?v=123')).toBe('x.server');
  });

  it('produces identical input for .ts source and .js specifier of the same module', () => {
    expect(normalizeActionPath('/proj', '/proj/x.server.ts')).toBe(
      normalizeActionPath('/proj', '/proj/x.server.js'),
    );
  });
});

describe('hashActionId', () => {
  it('is a 12-char lowercase hex string', () => {
    expect(hashActionId('posts/posts.server', 'getPost')).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is stable (snapshot — this value is a wire contract, never change it)', () => {
    // sha256('posts/posts.server#getPost') first 12 hex chars. The snapshot
    // is the wire contract: it must never change across releases.
    expect(hashActionId('posts/posts.server', 'getPost')).toMatchInlineSnapshot(`"63b4b61acbab"`);
  });

  it('differs across export names and paths', () => {
    expect(hashActionId('a.server', 'x')).not.toBe(hashActionId('a.server', 'y'));
    expect(hashActionId('a.server', 'x')).not.toBe(hashActionId('b.server', 'x'));
  });
});
