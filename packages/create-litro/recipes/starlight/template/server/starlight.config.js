export const siteConfig = {
  title: '{{projectName}}',
  description: 'Documentation and blog powered by Litro',
  logo: null,
  editUrlBase: null, // e.g. 'https://github.com/you/repo/edit/main'
  nav: [
    { label: 'Docs', href: '/docs/getting-started' },
    { label: 'Blog', href: '/blog' },
  ],
  sidebar: [
    {
      label: 'Start Here',
      items: [
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Installation',    slug: 'installation' },
        { label: 'Configuration',   slug: 'configuration' },
      ],
    },
    {
      label: 'Guides',
      items: [
        { label: 'Your First Page', slug: 'guides-first-page' },
        { label: 'Deploying',       slug: 'guides-deploying' },
      ],
    },
  ],
};

export default siteConfig;
