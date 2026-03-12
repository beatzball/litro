import{i as u,a as v,b as l,t as g}from"../app.js";import{o as w,e as D,a as S}from"./extract-headings-DkdRsUEm.js";import{c as _}from"./index-OyqQWMVl.js";import{s as P,L as O,b as f,d as k,a as i}from"./starlight-header-DzTENVp5.js";import{b as T}from"./seo-DSq8COSB.js";var C=Object.getOwnPropertyDescriptor,z=(e,t,o,r)=>{for(var a=r>1?void 0:r?C(t,o):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(a=n(a)||a);return a};let c=class extends v{constructor(){super(...arguments),this.groups=[],this.currentSlug=""}render(){return l`
      <nav aria-label="Site navigation">
        ${this.groups.map(e=>l`
          <div class="group">
            <p class="group-label">${e.label}</p>
            <ul>
              ${e.items.map(t=>l`
                <li>
                  <a
                    href="/docs/${t.slug}"
                    aria-current="${this.currentSlug===t.slug?"page":"false"}"
                  >
                    <span>${t.label}</span>
                    ${t.badge?l`<span class="badge">${t.badge.text}</span>`:""}
                  </a>
                </li>
              `)}
            </ul>
          </div>
        `)}
      </nav>
    `}};c.properties={groups:{type:Array},currentSlug:{type:String}};c.styles=u`
    :host {
      display: block;
    }

    nav {
      padding: 1rem 0;
    }

    .group {
      margin-bottom: 1.5rem;
    }

    .group-label {
      font-size: var(--sl-text-xs, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--sl-color-gray-4, #757575);
      padding: 0 1rem;
      margin: 0 0 0.5rem;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      margin: 0;
    }

    a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.35rem 1rem;
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: color 0.15s, background-color 0.15s;
    }

    a:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    a[aria-current='page'] {
      color: var(--sl-color-accent, #7c3aed);
      border-left-color: var(--sl-color-accent, #7c3aed);
      background-color: var(--sl-color-accent-low, #ede9fe);
      font-weight: 600;
    }

    .badge {
      display: inline-block;
      padding: 0.1em 0.45em;
      font-size: var(--sl-text-xs, 0.75rem);
      font-weight: 600;
      border-radius: 9999px;
      background-color: var(--sl-color-accent-low, #ede9fe);
      color: var(--sl-color-accent-high, #5b21b6);
      margin-left: 0.5rem;
    }
  `;c=z([g("starlight-sidebar")],c);var A=Object.getOwnPropertyDescriptor,j=(e,t,o,r)=>{for(var a=r>1?void 0:r?A(t,o):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(a=n(a)||a);return a};let d=class extends v{constructor(){super(...arguments),this.entries=[]}_handleClick(e,t){e.preventDefault();const o=this._findDeep(document,t);o&&o.scrollIntoView({behavior:"smooth"}),history.pushState(null,"",`#${t}`)}_findDeep(e,t){const o=`#${CSS.escape(t)}`,r=e.querySelector(o);if(r)return r;for(const a of e.querySelectorAll("*"))if(a.shadowRoot){const s=this._findDeep(a.shadowRoot,t);if(s)return s}return null}render(){if(!this.entries.length)return l``;const e=typeof location<"u"?location.hash:"";return l`
      <nav aria-label="On this page">
        <h2>On this page</h2>
        <ul>
          ${this.entries.map(t=>l`
            <li class="depth-${t.depth}">
              <a
                href="#${t.slug}"
                aria-current="${e==="#"+t.slug?"true":"false"}"
                @click=${o=>this._handleClick(o,t.slug)}
              >${t.text}</a>
            </li>
          `)}
        </ul>
      </nav>
    `}};d.properties={entries:{type:Array}};d.styles=u`
    :host {
      display: block;
    }

    nav {
      position: sticky;
      top: calc(var(--sl-nav-height, 3.5rem) + 1rem);
      max-height: calc(100vh - var(--sl-nav-height, 3.5rem) - 2rem);
      overflow-y: auto;
      padding: 0 0.5rem;
    }

    h2 {
      font-size: var(--sl-text-xs, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--sl-color-gray-4, #757575);
      margin: 0 0 0.75rem;
      padding: 0;
      border: none;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      margin: 0;
    }

    a {
      display: block;
      padding: 0.2rem 0;
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-4, #757575);
      text-decoration: none;
      transition: color 0.15s;
      border-left: 2px solid transparent;
    }

    a:hover {
      color: var(--sl-color-text, #23262f);
    }

    /* Depth indentation */
    .depth-2 a { padding-left: 0.75rem; }
    .depth-3 a { padding-left: 1.5rem; }
    .depth-4 a { padding-left: 2.25rem; }

    /* Active via [aria-current] set by the click handler */
    li a[aria-current='true'] {
      color: var(--sl-color-accent, #7c3aed);
      border-left-color: var(--sl-color-accent, #7c3aed);
    }
  `;d=j([g("starlight-toc")],d);var H=Object.getOwnPropertyDescriptor,L=(e,t,o,r)=>{for(var a=r>1?void 0:r?H(t,o):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(a=n(a)||a);return a};let p=class extends v{constructor(){super(...arguments),this.siteTitle="",this.pageTitle="",this.nav=[],this.sidebar=[],this.toc=[],this.currentSlug="",this.currentPath="",this.noSidebar=!1}render(){return l`
      <div class="page-wrap">
        <starlight-header
          siteTitle="${this.siteTitle}"
          .nav="${this.nav}"
          currentPath="${this.currentPath}"
        ></starlight-header>
        <div class="body${this.noSidebar?" no-sidebar":""}">
          ${this.noSidebar?"":l`
            <aside class="sidebar-wrap">
              <starlight-sidebar
                .groups="${this.sidebar}"
                currentSlug="${this.currentSlug}"
              ></starlight-sidebar>
            </aside>
          `}
          <main class="content-wrap">
            <div class="content-inner">
              ${this.pageTitle?l`<h1 class="page-title">${this.pageTitle}</h1>`:""}
              <slot name="content"></slot>
            </div>
          </main>
          ${this.noSidebar?"":l`
            <aside class="toc-wrap">
              <starlight-toc .entries="${this.toc}"></starlight-toc>
            </aside>
          `}
        </div>
      </div>
    `}};p.properties={siteTitle:{type:String},pageTitle:{type:String},nav:{type:Array},sidebar:{type:Array},toc:{type:Array},currentSlug:{type:String},currentPath:{type:String},noSidebar:{type:Boolean}};p.styles=u`
    :host {
      display: block;
    }

    .page-wrap {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .body {
      display: grid;
      grid-template-columns: var(--sl-sidebar-width, 16rem) 1fr var(--sl-toc-width, 14rem);
      grid-template-areas: 'sidebar content toc';
      flex: 1;
      max-width: 90rem;
      margin: 0 auto;
      width: 100%;
    }

    .body.no-sidebar {
      grid-template-columns: 1fr;
      grid-template-areas: 'content';
    }

    .sidebar-wrap {
      grid-area: sidebar;
      border-right: 1px solid var(--sl-color-border, #e8e8e8);
      background-color: var(--sl-color-bg-sidebar, #f6f6f6);
      position: sticky;
      top: var(--sl-nav-height, 3.5rem);
      height: calc(100vh - var(--sl-nav-height, 3.5rem));
      overflow-y: auto;
    }

    .content-wrap {
      grid-area: content;
      padding: var(--sl-content-pad-y, 2rem) var(--sl-content-pad-x, 1.5rem);
      min-width: 0;
    }

    .content-inner {
      max-width: var(--sl-content-width, 48rem);
    }

    .toc-wrap {
      grid-area: toc;
      border-left: 1px solid var(--sl-color-border, #e8e8e8);
      position: sticky;
      top: var(--sl-nav-height, 3.5rem);
      height: calc(100vh - var(--sl-nav-height, 3.5rem));
      overflow-y: auto;
      padding: var(--sl-content-pad-y, 2rem) 0 var(--sl-content-pad-y, 2rem) var(--sl-content-pad-x, 1.5rem);
    }

    .page-title {
      font-size: var(--sl-text-4xl, 2.25rem);
      font-weight: 700;
      color: var(--sl-color-text, #23262f);
      margin: 0 0 1.5rem;
      line-height: 1.15;
    }

    /* Responsive: hide sidebar and TOC on narrow screens */
    @media (max-width: 72rem) {
      .body {
        grid-template-columns: 1fr var(--sl-toc-width, 14rem);
        grid-template-areas: 'content toc';
      }

      .sidebar-wrap {
        display: none;
      }
    }

    @media (max-width: 48rem) {
      .body {
        grid-template-columns: 1fr;
        grid-template-areas: 'content';
      }

      .toc-wrap {
        display: none;
      }
    }
  `;p=L([g("starlight-page")],p);var R=Object.getOwnPropertyDescriptor,U=(e,t,o,r)=>{for(var a=r>1?void 0:r?R(t,o):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(a=n(a)||a);return a};function B(e,t){const o=e.flatMap(a=>a.items),r=o.findIndex(a=>a.slug===t);return{prevDoc:r>0?{label:o[r-1].label,href:`/docs/${o[r-1].slug}`}:null,nextDoc:r<o.length-1?{label:o[r+1].label,href:`/docs/${o[r+1].slug}`}:null}}const V=k(async e=>{var m;const t=((m=e.context.params)==null?void 0:m.slug)??"",r=(await f()).find($=>$.url===`/content/docs/${t}`);if(!r)throw _({statusCode:404,message:`Doc not found: ${t}`});const a=D(r.rawBody),s=S(r.body).replace(/^<h1[^>]*>.*?<\/h1>\s*/is,""),{prevDoc:n,nextDoc:b}=B(i.sidebar,t),y=`${i.editUrlBase}/content/docs/${t}.md`,x=T({title:`${r.title} — Litro`,description:r.description??i.description,path:`/docs/${t}`,type:"article"});return{doc:r,body:s,toc:a,sidebar:i.sidebar,siteTitle:i.title,currentSlug:t,prevDoc:n,nextDoc:b,nav:i.nav,editUrl:y,seoHead:x}});async function W(){return(await f()).filter(t=>t.url.startsWith("/content/docs/")).map(t=>"/docs"+t.url.slice(13))}const F={head:P,title:"Docs — Litro"};let h=class extends O{render(){const e=this.serverData;return e!=null&&e.doc?l`
      <starlight-page
        siteTitle="${e.siteTitle}"
        pageTitle="${e.doc.title}"
        .nav="${e.nav}"
        .sidebar="${e.sidebar}"
        .toc="${e.toc}"
        currentSlug="${e.currentSlug}"
        currentPath="/docs/${e.currentSlug}"
      >
        <div slot="content">
          ${w(e.body)}

          ${e.prevDoc||e.nextDoc?l`
            <nav style="
              display:flex;
              justify-content:space-between;
              padding-top:2rem;
              margin-top:2rem;
              border-top:1px solid var(--sl-color-border);
              font-size:var(--sl-text-sm);
            " aria-label="Previous and next pages">
              ${e.prevDoc?l`
                <a href="${e.prevDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  &larr; ${e.prevDoc.label}
                </a>
              `:l`<span></span>`}
              ${e.nextDoc?l`
                <a href="${e.nextDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  ${e.nextDoc.label} &rarr;
                </a>
              `:""}
            </nav>
          `:""}

          ${e.editUrl?l`
            <p style="margin-top:1.5rem;font-size:var(--sl-text-xs);color:var(--sl-color-gray-4);">
              <a href="${e.editUrl}" style="color:var(--sl-color-accent);" target="_blank" rel="noopener">
                Edit this page
              </a>
            </p>
          `:""}
        </div>
      </starlight-page>
    `:l`<p>Loading&hellip;</p>`}};h=U([g("page-docs-slug")],h);const G=h;export{h as DocPage,G as default,W as generateRoutes,V as pageData,F as routeMeta};
