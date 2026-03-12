import{b as l,t as p}from"../app.js";import{o as m,e as f,a as h}from"./extract-headings-DkdRsUEm.js";import{c as u}from"./index-OyqQWMVl.js";import{s as v,L as b,b as c,d as y,a as d}from"./starlight-header-DzTENVp5.js";import{i as x,f as w}from"./date-utils-CBLFH15h.js";var $=Object.getOwnPropertyDescriptor,P=(o,t,n,r)=>{for(var a=r>1?void 0:r?$(t,n):t,s=o.length-1,e;s>=0;s--)(e=o[s])&&(a=e(a)||a);return a};const H=y(async o=>{var e;const t=((e=o.context.params)==null?void 0:e.slug)??"",r=(await c()).find(g=>g.url===`/content/blog/${t}`);if(!r)throw u({statusCode:404,message:`Post not found: ${t}`});const a=f(r.rawBody),s=h(r.body);return{post:r,body:s,toc:a,siteTitle:d.title,nav:d.nav}});async function _(){return(await c()).filter(t=>t.url.startsWith("/content/blog/")).map(t=>"/blog"+t.url.slice(13))}const M={head:v,title:"Blog — Litro"};let i=class extends b{render(){const o=this.serverData;if(!(o!=null&&o.post))return l`<p>Loading&hellip;</p>`;const{post:t,body:n,siteTitle:r,nav:a}=o,s=t.url.slice(14);return l`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${r}"
          .nav="${a}"
          currentPath="/blog/${s}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:52rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <article>
            <header style="margin-bottom:2rem;">
              <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 0.75rem;line-height:1.15;">
                ${t.title}
              </h1>
              <time
                datetime="${x(t.date)}"
                style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
              >${w(t.date)}</time>
              ${t.tags.filter(e=>e!=="posts").length>0?l`
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">
                  ${t.tags.filter(e=>e!=="posts").map(e=>l`
                    <a href="/blog/tags/${e}" style="
                      display:inline-block;
                      padding:0.15em 0.55em;
                      font-size:var(--sl-text-xs);
                      border-radius:9999px;
                      background:var(--sl-color-accent-low);
                      color:var(--sl-color-accent-high,#5b21b6);
                      text-decoration:none;
                      font-weight:600;
                    ">#${e}</a>
                  `)}
                </div>
              `:""}
            </header>
            <!-- unsafeHTML renders the Markdown-generated HTML directly.
                 The content directory is trusted-author-only; do not place
                 user-submitted or untrusted content here without sanitizing. -->
            ${m(n)}
          </article>
          <footer style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--sl-color-border);">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              &larr; Back to Blog
            </a>
          </footer>
        </main>
      </div>
    `}};i=P([p("page-blog-slug")],i);const k=i;export{i as BlogPostPage,k as default,_ as generateRoutes,H as pageData,M as routeMeta};
