import{b as a,t as d}from"../app.js";import{s as c,L as m,d as p,b as f,a as g}from"./starlight-header-DzTENVp5.js";import{i as h,f as v}from"./date-utils-CBLFH15h.js";var x=Object.getOwnPropertyDescriptor,y=(o,r,i,l)=>{for(var t=l>1?void 0:l?x(r,i):r,s=o.length-1,e;s>=0;s--)(e=o[s])&&(t=e(t)||t);return t};const w=p(async o=>({posts:(await f()).filter(l=>l.url.startsWith("/content/blog/")),siteTitle:g.title,nav:g.nav})),P={head:c,title:"Blog — Litro"};let n=class extends m{render(){const o=this.serverData,{posts:r=[],siteTitle:i="Litro",nav:l=[]}=o??{};return a`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${i}"
          .nav="${l}"
          currentPath="/blog"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="
            font-size:var(--sl-text-4xl);
            font-weight:700;
            margin:0 0 2rem;
          ">Blog</h1>

          ${r.length===0?a`
            <p style="color:var(--sl-color-gray-4);">No posts yet.</p>
          `:a`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:2rem;">
              ${r.map(t=>{const s=t.url.slice(14);return a`
                  <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:2rem;">
                    <a href="/blog/${s}" style="
                      display:block;
                      font-size:var(--sl-text-2xl);
                      font-weight:600;
                      color:var(--sl-color-text);
                      text-decoration:none;
                      margin-bottom:0.4rem;
                    ">${t.title}</a>
                    <time
                      datetime="${h(t.date)}"
                      style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                    >${v(t.date)}</time>
                    ${t.description?a`
                      <p style="margin:0.5rem 0 0.75rem;color:var(--sl-color-gray-5);line-height:1.6;">
                        ${t.description}
                      </p>
                    `:""}
                    ${t.tags.filter(e=>e!=="posts").length>0?a`
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
                        ${t.tags.filter(e=>e!=="posts").map(e=>a`
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
                  </li>
                `})}
            </ul>
          `}
        </main>
      </div>
    `}};n=y([d("page-blog")],n);const D=n;export{n as BlogIndexPage,D as default,w as pageData,P as routeMeta};
