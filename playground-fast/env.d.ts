// Type declarations for @microsoft/fast-ssr subpath imports that lack type
// exports. Mirrors packages/framework/src/adapter/fast/env.d.ts (framework
// package source, off limits to modify) — needed here too because
// components/demo-weather-card.ts imports this subpath directly (see that
// file's header comment for why).
declare module '@microsoft/fast-ssr/install-dom-shim.js' {
  const _default: void;
  export default _default;
}
