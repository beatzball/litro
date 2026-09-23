export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/', '/blog/hello'],
    },
  },
  compatibilityDate: '2026-09-22',
});
