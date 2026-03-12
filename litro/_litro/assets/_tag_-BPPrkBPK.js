import{b as l,t as d}from"../app.js";import{s as m,L as p,b as c,d as f,a as g}from"./starlight-header-DzTENVp5.js";import{i as v,f as h}from"./date-utils-CBLFH15h.js";var y=Object.getOwnPropertyDescriptor,u=(r,a,s,t)=>{for(var o=t>1?void 0:t?y(a,s):a,e=r.length-1,n;e>=0;e--)(n=r[e])&&(o=n(o)||o);return o};const P=f(async r=>{var o;const a=((o=r.context.params)==null?void 0:o.tag)??"",t=(await c()).filter(e=>e.url.startsWith("/content/blog/"));return{tag:a,posts:t,siteTitle:g.title,nav:g.nav}});async function w(){const a=(await c()).filter(t=>t.url.startsWith("/content/blog/"));return[...new Set(a.flatMap(t=>t.tags))].sort().map(t=>`/blog/tags/${t}`)}const D={head:m,title:"Tags — Litro"};let i=class extends p{render(){const r=this.serverData,{tag:a="",posts:s=[],siteTitle:t="Litro",nav:o=[]}=r??{};return l`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${t}"
          .nav="${o}"
          currentPath="/blog/tags/${a}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">
            Posts tagged: <span style="color:var(--sl-color-accent);">#${a}</span>
          </h1>

          ${s.length===0?l`
            <p style="color:var(--sl-color-gray-4);">No posts found for this tag.</p>
          `:l`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.5rem;">
              ${s.map(e=>{const n=e.url.slice(14);return l`
                  <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:1.5rem;">
                    <a href="/blog/${n}" style="
                      display:block;
                      font-size:var(--sl-text-xl);
                      font-weight:600;
                      color:var(--sl-color-text);
                      text-decoration:none;
                      margin-bottom:0.3rem;
                    ">${e.title}</a>
                    <time
                      datetime="${v(e.date)}"
                      style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                    >${h(e.date)}</time>
                    ${e.description?l`
                      <p style="margin:0.4rem 0 0;color:var(--sl-color-gray-5);">${e.description}</p>
                    `:""}
                  </li>
                `})}
            </ul>
          `}

          <p style="margin-top:2rem;">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              &larr; All Posts
            </a>
          </p>
        </main>
      </div>
    `}};i=u([d("page-blog-tags-tag")],i);const T=i;export{i as TagPage,T as default,w as generateRoutes,P as pageData,D as routeMeta};
