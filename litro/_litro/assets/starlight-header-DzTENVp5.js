import{r as c,a as d,i as u,b as s,t as h}from"../app.js";function _(e){return{__litroPageData:!0,fetcher:e}}function m(){if(typeof document>"u")return null;const e=document.getElementById("__litro_data__");if(!e)return null;try{const r=JSON.parse(e.textContent||"");return e.remove(),r}catch{return null}}var f=Object.defineProperty,g=(e,r,l,a)=>{for(var t=void 0,o=e.length-1,i;o>=0;o--)(i=e[o])&&(t=i(r,l,t)||t);return t&&f(r,l,t),t};const b=e=>{class r extends e{constructor(){super(...arguments),this.serverData=null,this.loading=!1}connectedCallback(){if(super.connectedCallback(),this.serverData===null&&typeof document<"u"){const a=document.getElementById("__litro_data__");if(a)try{this.serverData=JSON.parse(a.textContent||"")}catch{}}}async onBeforeEnter(a){const t=m();if(t!==null){this.serverData=t;return}this.loading=!0;try{this.serverData=await this.fetchData(a)}finally{this.loading=!1}}async fetchData(a){return null}}return g([c()],r.prototype,"serverData"),g([c()],r.prototype,"loading"),r};class k extends b(d){}async function x(e){return[]}async function S(){return{}}const w={title:"Litro",description:"The fullstack Lit framework — components, SSR, and static generation in one.",nav:[{label:"Docs",href:"/docs/introduction"},{label:"Blog",href:"/blog"},{label:"GitHub",href:"https://github.com/beatzball/litro"}],sidebar:[{label:"Getting Started",items:[{label:"Introduction",slug:"introduction"},{label:"Getting Started",slug:"getting-started"},{label:"Configuration",slug:"configuration"}]},{label:"Core Concepts",items:[{label:"Routing",slug:"core-concepts/routing"},{label:"SSR",slug:"core-concepts/ssr"},{label:"Data Fetching",slug:"core-concepts/data-fetching"},{label:"Client Router",slug:"core-concepts/client-router"}]},{label:"Features",items:[{label:"API Routes",slug:"api-routes"},{label:"Content Layer",slug:"content-layer"},{label:"Static Generation",slug:"ssg"},{label:"LitroRouter",slug:"litro-router"}]},{label:"Recipes",items:[{label:"Fullstack App",slug:"recipes/fullstack"},{label:"11ty Blog",slug:"recipes/11ty-blog"},{label:"Starlight Docs",slug:"recipes/starlight"}]},{label:"Deployment",items:[{label:"GitHub Pages",slug:"deployment/github-pages"},{label:"Coolify",slug:"deployment/coolify"}]},{label:"Contributing",items:[{label:"Contributing",slug:"contributing"}]}],editUrlBase:"https://github.com/beatzball/litro/edit/main/docs"},C=['<link rel="icon" type="image/png" href="/logo.png" />','<link rel="stylesheet" href="/shoelace/themes/light.css" />','<link rel="stylesheet" href="/styles/starlight.css" />',"<script>(function(){",'var s=localStorage.getItem("sl-theme");','var t=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");','document.documentElement.setAttribute("data-theme",t);',"})();<\/script>"].join("");var p=Object.getOwnPropertyDescriptor,v=(e,r,l,a)=>{for(var t=a>1?void 0:a?p(r,l):r,o=e.length-1,i;o>=0;o--)(i=e[o])&&(t=i(t)||t);return t};let n=class extends d{constructor(){super(...arguments),this.siteTitle="",this.nav=[],this.currentPath="",this._theme="light"}firstUpdated(){const r=(typeof localStorage<"u"?localStorage.getItem("sl-theme"):null)??(typeof window<"u"&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");this._theme=r,typeof document<"u"&&document.documentElement.setAttribute("data-theme",r)}_toggleTheme(){const e=this._theme==="light"?"dark":"light";this._theme=e,typeof localStorage<"u"&&localStorage.setItem("sl-theme",e),typeof document<"u"&&document.documentElement.setAttribute("data-theme",e)}render(){const e=this._theme==="dark"?"sun":"moon",r=this._theme==="dark"?"Switch to light mode":"Switch to dark mode",l=this.nav.filter(t=>!t.href.includes("github.com")),a=this.nav.find(t=>t.href.includes("github.com"));return s`
      <header>
        <a class="site-title" href="/">
          <img class="site-logo" src="/logo.png" alt="" aria-hidden="true" />
          ${this.siteTitle}
        </a>
        <nav aria-label="Main navigation">
          ${l.map(t=>s`
            <a
              href="${t.href}"
              aria-current="${this.currentPath.startsWith(t.href)?"page":"false"}"
            >${t.label}</a>
          `)}
        </nav>
        <div class="header-actions">
          ${a?s`
            <a class="github-link" href="${a.href}" target="_blank" rel="noopener" aria-label="GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
          `:""}
          <sl-icon-button
            name="${e}"
            label="${r}"
            @click="${this._toggleTheme}"
          ></sl-icon-button>
        </div>
      </header>
    `}};n.properties={siteTitle:{type:String},nav:{type:Array},currentPath:{type:String},_theme:{type:String,state:!0}};n.styles=u`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    header {
      height: var(--sl-nav-height, 3.5rem);
      background-color: var(--sl-color-bg-nav, #fff);
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
      display: flex;
      align-items: center;
      padding: 0 var(--sl-content-pad-x, 1.5rem);
      gap: 1.5rem;
    }

    .site-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--sl-text-lg, 1.125rem);
      font-weight: 700;
      color: var(--sl-color-text, #23262f);
      text-decoration: none;
      white-space: nowrap;
    }

    .site-title:hover { opacity: 0.85; }

    .site-logo {
      width: 1.75rem;
      height: 1.75rem;
      object-fit: contain;
      flex-shrink: 0;
    }

    nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
    }

    nav a {
      padding: 0.35rem 0.75rem;
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 500;
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      border-radius: var(--sl-border-radius, 0.375rem);
      transition: color 0.15s, background-color 0.15s;
    }

    nav a:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    nav a[aria-current='page'] {
      color: var(--sl-color-accent, #7c3aed);
      background-color: var(--sl-color-accent-low, #ede9fe);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }

    .github-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--sl-border-radius, 0.375rem);
      color: var(--sl-color-gray-5, #4b4b4b);
      text-decoration: none;
      transition: color 0.15s, background-color 0.15s;
    }

    .github-link:hover {
      color: var(--sl-color-text, #23262f);
      background-color: var(--sl-color-gray-2, #e8e8e8);
    }

    .github-link svg {
      width: 1.2rem;
      height: 1.2rem;
      fill: currentColor;
    }

    sl-icon-button {
      font-size: 1.1rem;
      color: var(--sl-color-text, #23262f);
    }
  `;n=v([h("starlight-header")],n);export{k as L,w as a,x as b,_ as d,S as g,C as s};
