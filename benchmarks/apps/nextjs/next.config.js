/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Next type-checks as part of `next build`; Litro and Nuxt do not. Leaving it
  // on put a `run-typescript` span worth ~23% of Next's build inside the number
  // this benchmark compares against `litro build --mode static` (Vite + Nitro,
  // transpile only) and `nuxi generate` (no type check unless
  // `typescript.typeCheck` is set, and it is not). All three now transpile only.
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
