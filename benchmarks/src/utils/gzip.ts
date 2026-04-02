import { gzipSync } from 'node:zlib';

export function gzipSize(buf: Buffer): number {
  return gzipSync(buf).byteLength;
}
