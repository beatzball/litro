import{i as m,a as g,b as s,t as h}from"../app.js";import{s as v,L as f,d as u,g as y,a as l}from"./starlight-header-DzTENVp5.js";import{b}from"./seo-DSq8COSB.js";var x=Object.getOwnPropertyDescriptor,w=(r,i,a,o)=>{for(var t=o>1?void 0:o?x(i,a):i,e=r.length-1,n;e>=0;e--)(n=r[e])&&(t=n(t)||t);return t};let c=class extends g{constructor(){super(...arguments),this.title="",this.description="",this.icon="",this.iconSrc="",this.href=""}render(){const r=s`
      <div class="card-header">
        ${this.iconSrc?s`<img class="card-icon-img" src="${this.iconSrc}" alt="" aria-hidden="true" />`:this.icon?s`<span class="card-icon">${this.icon}</span>`:""}
        <p class="card-title">${this.title}</p>
      </div>
      ${this.description?s`<p class="card-desc">${this.description}</p>`:""}
      <div class="card-slot"><slot></slot></div>
    `;return this.href?s`<a class="card" href="${this.href}">${r}</a>`:s`<div class="card">${r}</div>`}};c.properties={title:{type:String},description:{type:String},icon:{type:String},iconSrc:{type:String},href:{type:String}};c.styles=m`
    :host {
      display: flex;
      flex-direction: column;
      counter-increment: card;
    }

    .card {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 1.25rem 1.5rem;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      background-color: var(--sl-color-bg, #fff);
      border-top: 4px solid;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }

    /* Rotate accent colors using counter — cycles through 4 variants */
    :host(:nth-child(4n+1)) .card { border-top-color: var(--sl-color-accent, #7c3aed); }
    :host(:nth-child(4n+2)) .card { border-top-color: var(--sl-color-note, #1d4ed8); }
    :host(:nth-child(4n+3)) .card { border-top-color: var(--sl-color-tip, #15803d); }
    :host(:nth-child(4n+0)) .card { border-top-color: var(--sl-color-caution, #b45309); }

    a.card:hover {
      box-shadow: var(--sl-shadow-md, 0 4px 16px rgba(0,0,0,.12));
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.4rem;
    }

    .card-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
      line-height: 1;
    }

    .card-icon-img {
      width: 1.5rem;
      height: 1.5rem;
      object-fit: contain;
      flex-shrink: 0;
    }

    .card-title {
      font-size: var(--sl-text-lg, 1.125rem);
      font-weight: 600;
      color: var(--sl-color-text, #23262f);
      margin: 0;
    }

    .card-desc {
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-4, #757575);
      margin: 0;
      line-height: 1.6;
    }

    .card-slot {
      margin-top: 0.75rem;
    }
  `;c=w([h("litro-card")],c);var S=Object.getOwnPropertyDescriptor,$=(r,i,a,o)=>{for(var t=o>1?void 0:o?S(i,a):i,e=r.length-1,n;e>=0;e--)(n=r[e])&&(t=n(t)||t);return t};let d=class extends g{render(){return s`
      <div class="grid">
        <slot></slot>
      </div>
    `}};d.styles=m`
    :host {
      display: block;
      counter-reset: card;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1.25rem;
    }
  `;d=$([h("litro-card-grid")],d);var D=Object.getOwnPropertyDescriptor,P=(r,i,a,o)=>{for(var t=o>1?void 0:o?D(i,a):i,e=r.length-1,n;e>=0;e--)(n=r[e])&&(t=n(t)||t);return t};const C=u(async r=>{const i=await y(),a=String(i.title??l.title),o=String(i.description??l.description),t=b({title:a,description:o,path:"/",type:"website"});return{siteTitle:a,description:o,nav:l.nav,features:[{iconSrc:"/logos/lit-flame.svg",title:"Lit Components",description:"Standard web components — no VDOM, no proprietary runtime. Works anywhere."},{iconSrc:"/logos/nitro.svg",title:"Nitro Server",description:"API routes, middleware, and every Nitro deployment adapter out of the box."},{icon:"🚀",title:"Streaming SSR",description:"Declarative Shadow DOM streaming via @lit-labs/ssr. Fast first paint."},{icon:"🔀",title:"File-System Routing",description:"Pages folder maps directly to URLs. Dynamic segments, catch-alls, nested routes."},{icon:"🏗️",title:"Static Generation",description:"Prerender all routes to HTML. Deploy to any CDN with zero server cost."},{icon:"📝",title:"Content Layer",description:"Markdown content with 11ty-compatible frontmatter and data cascade."}],seoHead:t}}),z={head:v,title:"Litro — Fullstack Lit Framework"};let p=class extends f{render(){const r=this.serverData,{siteTitle:i="Litro",description:a="",nav:o=[],features:t=[]}=r??{};return s`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${i}"
          .nav="${o}"
          currentPath="/"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:4rem 1.5rem 3rem;
          width:100%;
        ">
          <section style="text-align:center;margin-bottom:4rem;">
            <img
              src="/logo.png"
              alt="Litro logo"
              style="width:7rem;height:7rem;object-fit:contain;margin-bottom:1rem;"
            />
            <h1 style="
              font-size:clamp(2rem,5vw,3.5rem);
              font-weight:800;
              color:var(--sl-color-text);
              margin:0 0 1rem;
              line-height:1.1;
            ">${i}</h1>
            ${a?s`
              <p style="
                font-size:var(--sl-text-xl);
                color:var(--sl-color-gray-4);
                max-width:36rem;
                margin:0 auto 2.5rem;
                line-height:1.6;
              ">${a}</p>
            `:""}
            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              <sl-button variant="primary" size="medium" href="/docs/introduction">Get Started</sl-button>
              <sl-button variant="default" size="medium" href="/blog">Blog</sl-button>
            </div>
          </section>

          <section>
            <litro-card-grid>
              ${t.map(e=>s`
                <litro-card
                  icon="${e.icon??""}"
                  iconSrc="${e.iconSrc??""}"
                  title="${e.title}"
                  description="${e.description}"
                ></litro-card>
              `)}
            </litro-card-grid>
          </section>
        </main>
      </div>
    `}};p=P([h("page-home")],p);const j=p;export{p as SplashPage,j as default,C as pageData,z as routeMeta};
