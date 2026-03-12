import{d as s,s as t}from"./index-OyqQWMVl.js";var c={};const r=(c.SITE_URL??"https://litro.dev").replace(/\/$/,""),n=["/","/blog","/docs/introduction","/docs/getting-started","/docs/configuration","/docs/core-concepts/routing","/docs/core-concepts/ssr","/docs/core-concepts/data-fetching","/docs/core-concepts/client-router","/docs/api-routes","/docs/content-layer","/docs/ssg","/docs/litro-router","/docs/recipes/fullstack","/docs/recipes/11ty-blog","/docs/recipes/starlight","/docs/deployment/github-pages","/docs/deployment/coolify","/docs/contributing"],l=s(o=>(t(o,"content-type","application/xml; charset=utf-8"),`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${n.map(e=>`
  <url>
    <loc>${r}${e}</loc>
    <changefreq>weekly</changefreq>
    <priority>${e==="/"?"1.0":"0.8"}</priority>
  </url>`).join("")}
</urlset>`));export{l as default};
