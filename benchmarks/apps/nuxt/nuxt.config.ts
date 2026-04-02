export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/', '/blog/hello'],
    },
  },
  compatibilityDate: '2026-04-01',
});
