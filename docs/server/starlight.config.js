export const siteConfig = {
  title: 'Litro',
  description: 'The fullstack Lit framework — components, SSR, and static generation in one.',
  nav: [
    { label: 'Docs', href: '/docs/introduction' },
    { label: 'Blog', href: '/blog' },
    { label: 'GitHub', href: 'https://github.com/beatzball/litro' },
  ],
  sidebar: [
    {
      label: 'Getting Started',
      items: [
        { label: 'Introduction', slug: 'introduction' },
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Configuration', slug: 'configuration' },
      ],
    },
    {
      label: 'Core Concepts',
      items: [
        { label: 'Routing', slug: 'core-concepts/routing' },
        { label: 'SSR', slug: 'core-concepts/ssr' },
        { label: 'Data Fetching', slug: 'core-concepts/data-fetching' },
        { label: 'Client Router', slug: 'core-concepts/client-router' },
      ],
    },
    {
      label: 'Features',
      items: [
        { label: 'API Routes', slug: 'api-routes' },
        { label: 'Content Layer', slug: 'content-layer' },
        { label: 'Static Generation', slug: 'ssg' },
        { label: 'LitroRouter', slug: 'litro-router' },
      ],
    },
    {
      label: 'Recipes',
      items: [
        { label: 'Fullstack App', slug: 'recipes/fullstack' },
        { label: '11ty Blog', slug: 'recipes/11ty-blog' },
        { label: 'Starlight Docs', slug: 'recipes/starlight' },
      ],
    },
    {
      label: 'Deployment',
      items: [
        { label: 'GitHub Pages', slug: 'deployment/github-pages' },
        { label: 'Coolify', slug: 'deployment/coolify' },
      ],
    },
    {
      label: 'Packages',
      items: [
        { label: '@beatzball/litro',        slug: 'packages/litro' },
        { label: '@beatzball/litro-router', slug: 'packages/litro-router' },
        { label: '@beatzball/create-litro', slug: 'packages/create-litro' },
      ],
    },
    {
      label: 'Contributing',
      items: [
        { label: 'Contributing', slug: 'contributing' },
      ],
    },
  ],
  editUrlBase: 'https://github.com/beatzball/litro/edit/main/docs',
};
