/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // See the cross-framework app's next.config.js: Next is the only one of the
  // three that type-checks during a build, so it is turned off here to keep the
  // measured builds comparable. All three transpile only.
  typescript: { ignoreBuildErrors: true },
};
module.exports = nextConfig;
