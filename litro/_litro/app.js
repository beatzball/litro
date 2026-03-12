const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CNUHFB0B.js","assets/starlight-header-DzTENVp5.js","assets/seo-DSq8COSB.js","assets/index-BDLogV3J.js","assets/date-utils-CBLFH15h.js","assets/sitemap.xml-BUnEn-7s.js","assets/index-OyqQWMVl.js","assets/_slug_-mN6PdFqV.js","assets/extract-headings-DkdRsUEm.js","assets/_tag_-BPPrkBPK.js","assets/_...slug_-kV-pnBST.js"])))=>i.map(i=>d[i]);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Kt=globalThis,eo=t=>t,ce=Kt.trustedTypes,oo=ce?ce.createPolicy("lit-html",{createHTML:t=>t}):void 0,Bo="$lit$",ht=`lit$${Math.random().toFixed(9).slice(2)}$`,Do="?"+ht,br=`<${Do}>`,kt=document,Xt=()=>kt.createComment(""),Gt=t=>t===null||typeof t!="object"&&typeof t!="function",We=Array.isArray,Io=t=>We(t)||typeof(t==null?void 0:t[Symbol.iterator])=="function",Ce=`[ 	
\f\r]`,Ft=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ro=/-->/g,so=/>/g,wt=RegExp(`>|${Ce}(?:([^\\s"'>=/]+)(${Ce}*=${Ce}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),io=/'/g,no=/"/g,Mo=/^(?:script|style|textarea|title)$/i,gr=t=>(e,...o)=>({_$litType$:t,strings:e,values:o}),T=gr(1),ft=Symbol.for("lit-noChange"),S=Symbol.for("lit-nothing"),ao=new WeakMap,$t=kt.createTreeWalker(kt,129);function No(t,e){if(!We(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return oo!==void 0?oo.createHTML(e):e}const mr=(t,e)=>{const o=t.length-1,r=[];let s,i=e===2?"<svg>":e===3?"<math>":"",n=Ft;for(let a=0;a<o;a++){const l=t[a];let d,u,h=-1,b=0;for(;b<l.length&&(n.lastIndex=b,u=n.exec(l),u!==null);)b=n.lastIndex,n===Ft?u[1]==="!--"?n=ro:u[1]!==void 0?n=so:u[2]!==void 0?(Mo.test(u[2])&&(s=RegExp("</"+u[2],"g")),n=wt):u[3]!==void 0&&(n=wt):n===wt?u[0]===">"?(n=s??Ft,h=-1):u[1]===void 0?h=-2:(h=n.lastIndex-u[2].length,d=u[1],n=u[3]===void 0?wt:u[3]==='"'?no:io):n===no||n===io?n=wt:n===ro||n===so?n=Ft:(n=wt,s=void 0);const f=n===wt&&t[a+1].startsWith("/>")?" ":"";i+=n===Ft?l+br:h>=0?(r.push(d),l.slice(0,h)+Bo+l.slice(h)+ht+f):l+ht+(h===-2?a:f)}return[No(t,i+(t[o]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),r]};let Be=class Fo{constructor({strings:e,_$litType$:o},r){let s;this.parts=[];let i=0,n=0;const a=e.length-1,l=this.parts,[d,u]=mr(e,o);if(this.el=Fo.createElement(d,r),$t.currentNode=this.el.content,o===2||o===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(s=$t.nextNode())!==null&&l.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(const h of s.getAttributeNames())if(h.endsWith(Bo)){const b=u[n++],f=s.getAttribute(h).split(ht),g=/([.?@])?(.*)/.exec(b);l.push({type:1,index:i,name:g[2],strings:f,ctor:g[1]==="."?vr:g[1]==="?"?yr:g[1]==="@"?wr:ve}),s.removeAttribute(h)}else h.startsWith(ht)&&(l.push({type:6,index:i}),s.removeAttribute(h));if(Mo.test(s.tagName)){const h=s.textContent.split(ht),b=h.length-1;if(b>0){s.textContent=ce?ce.emptyScript:"";for(let f=0;f<b;f++)s.append(h[f],Xt()),$t.nextNode(),l.push({type:2,index:++i});s.append(h[b],Xt())}}}else if(s.nodeType===8)if(s.data===Do)l.push({type:2,index:i});else{let h=-1;for(;(h=s.data.indexOf(ht,h+1))!==-1;)l.push({type:7,index:i}),h+=ht.length-1}i++}}static createElement(e,o){const r=kt.createElement("template");return r.innerHTML=e,r}};function Et(t,e,o=t,r){var n,a;if(e===ft)return e;let s=r!==void 0?(n=o._$Co)==null?void 0:n[r]:o._$Cl;const i=Gt(e)?void 0:e._$litDirective$;return(s==null?void 0:s.constructor)!==i&&((a=s==null?void 0:s._$AO)==null||a.call(s,!1),i===void 0?s=void 0:(s=new i(t),s._$AT(t,o,r)),r!==void 0?(o._$Co??(o._$Co=[]))[r]=s:o._$Cl=s),s!==void 0&&(e=Et(t,s._$AS(t,e.values),s,r)),e}class Ho{constructor(e,o){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=o}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:o},parts:r}=this._$AD,s=((e==null?void 0:e.creationScope)??kt).importNode(o,!0);$t.currentNode=s;let i=$t.nextNode(),n=0,a=0,l=r[0];for(;l!==void 0;){if(n===l.index){let d;l.type===2?d=new Bt(i,i.nextSibling,this,e):l.type===1?d=new l.ctor(i,l.name,l.strings,this,e):l.type===6&&(d=new Vo(i,this,e)),this._$AV.push(d),l=r[++a]}n!==(l==null?void 0:l.index)&&(i=$t.nextNode(),n++)}return $t.currentNode=kt,s}p(e){let o=0;for(const r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(e,r,o),o+=r.strings.length-2):r._$AI(e[o])),o++}}class Bt{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,o,r,s){this.type=2,this._$AH=S,this._$AN=void 0,this._$AA=e,this._$AB=o,this._$AM=r,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let e=this._$AA.parentNode;const o=this._$AM;return o!==void 0&&(e==null?void 0:e.nodeType)===11&&(e=o.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,o=this){e=Et(this,e,o),Gt(e)?e===S||e==null||e===""?(this._$AH!==S&&this._$AR(),this._$AH=S):e!==this._$AH&&e!==ft&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Io(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==S&&Gt(this._$AH)?this._$AA.nextSibling.data=e:this.T(kt.createTextNode(e)),this._$AH=e}$(e){var i;const{values:o,_$litType$:r}=e,s=typeof r=="number"?this._$AC(e):(r.el===void 0&&(r.el=Be.createElement(No(r.h,r.h[0]),this.options)),r);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(o);else{const n=new Ho(s,this),a=n.u(this.options);n.p(o),this.T(a),this._$AH=n}}_$AC(e){let o=ao.get(e.strings);return o===void 0&&ao.set(e.strings,o=new Be(e)),o}k(e){We(this._$AH)||(this._$AH=[],this._$AR());const o=this._$AH;let r,s=0;for(const i of e)s===o.length?o.push(r=new Bt(this.O(Xt()),this.O(Xt()),this,this.options)):r=o[s],r._$AI(i),s++;s<o.length&&(this._$AR(r&&r._$AB.nextSibling,s),o.length=s)}_$AR(e=this._$AA.nextSibling,o){var r;for((r=this._$AP)==null?void 0:r.call(this,!1,!0,o);e!==this._$AB;){const s=eo(e).nextSibling;eo(e).remove(),e=s}}setConnected(e){var o;this._$AM===void 0&&(this._$Cv=e,(o=this._$AP)==null||o.call(this,e))}}class ve{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,o,r,s,i){this.type=1,this._$AH=S,this._$AN=void 0,this.element=e,this.name=o,this._$AM=s,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=S}_$AI(e,o=this,r,s){const i=this.strings;let n=!1;if(i===void 0)e=Et(this,e,o,0),n=!Gt(e)||e!==this._$AH&&e!==ft,n&&(this._$AH=e);else{const a=e;let l,d;for(e=i[0],l=0;l<i.length-1;l++)d=Et(this,a[r+l],o,l),d===ft&&(d=this._$AH[l]),n||(n=!Gt(d)||d!==this._$AH[l]),d===S?e=S:e!==S&&(e+=(d??"")+i[l+1]),this._$AH[l]=d}n&&!s&&this.j(e)}j(e){e===S?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class vr extends ve{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===S?void 0:e}}class yr extends ve{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==S)}}class wr extends ve{constructor(e,o,r,s,i){super(e,o,r,s,i),this.type=5}_$AI(e,o=this){if((e=Et(this,e,o,0)??S)===ft)return;const r=this._$AH,s=e===S&&r!==S||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,i=e!==S&&(r===S||s);s&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var o;typeof this._$AH=="function"?this._$AH.call(((o=this.options)==null?void 0:o.host)??this.element,e):this._$AH.handleEvent(e)}}class Vo{constructor(e,o,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=o,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){Et(this,e)}}const Ht={R:Ho,D:Io,V:Et,I:Bt,F:Vo},ke=Kt.litHtmlPolyfillSupport;ke==null||ke(Be,Bt),(Kt.litHtmlVersions??(Kt.litHtmlVersions=[])).push("3.3.2");const Uo=(t,e,o)=>{const r=(o==null?void 0:o.renderBefore)??e;let s=r._$litPart$;if(s===void 0){const i=(o==null?void 0:o.renderBefore)??null;r._$litPart$=s=new Bt(e.insertBefore(Xt(),i),i,void 0,o??{})}return s._$AI(t),s},_r={resolveDirective:Ht.V,ElementPart:Ht.F,TemplateInstance:Ht.R,isIterable:Ht.D,ChildPart:Ht.I};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pt={ATTRIBUTE:1,CHILD:2,PROPERTY:3,EVENT:5,ELEMENT:6},xr=t=>(...e)=>({_$litDirective$:t,values:e});let $r=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,o,r){this._$Ct=e,this._$AM=o,this._$Ci=r}_$AS(e,o){return this.update(e,o)}update(e,o){return this.render(...o)}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ar=t=>t===null||typeof t!="object"&&typeof t!="function",Wo=(t,e)=>(t==null?void 0:t._$litType$)!==void 0,Cr=t=>{var e;return((e=t==null?void 0:t._$litType$)==null?void 0:e.h)!=null},kr=t=>t.strings===void 0;/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{TemplateInstance:Er,isIterable:Sr,resolveDirective:jo,ChildPart:Vt,ElementPart:Pr}=_r,Tr=(t,e,o={})=>{if(e._$litPart$!==void 0)throw Error("container already contains a live render");let r,s,i;const n=[],a=document.createTreeWalker(e,NodeFilter.SHOW_COMMENT);let l;for(;(l=a.nextNode())!==null;){const d=l.data;if(d.startsWith("lit-part")){if(n.length===0&&r!==void 0)throw Error(`There must be only one root part per container. Found a part marker (${l}) when we already have a root part marker (${s})`);i=Or(t,l,n,o),r===void 0&&(r=i),s??(s=l)}else if(d.startsWith("lit-node"))Rr(l,n,o);else if(d.startsWith("/lit-part")){if(n.length===1&&i!==r)throw Error("internal error");i=Lr(l,i,n)}}if(r===void 0){const d=e instanceof ShadowRoot?"{container.host.localName}'s shadow root":e instanceof DocumentFragment?"DocumentFragment":e.localName;console.error(`There should be exactly one root part in a render container, but we didn't find any in ${d}.`)}e._$litPart$=r},Or=(t,e,o,r)=>{let s,i;if(o.length===0)i=new Vt(e,null,void 0,r),s=t;else{const n=o[o.length-1];if(n.type==="template-instance")i=new Vt(e,null,n.instance,r),n.instance._$AV.push(i),s=n.result.values[n.instancePartIndex++],n.templatePartIndex++;else if(n.type==="iterable"){i=new Vt(e,null,n.part,r);const a=n.iterator.next();if(a.done)throw s=void 0,n.done=!0,Error("Unhandled shorter than expected iterable");s=a.value,n.part._$AH.push(i)}else i=new Vt(e,null,n.part,r)}if(s=jo(i,s),s===ft)o.push({part:i,type:"leaf"});else if(Ar(s))o.push({part:i,type:"leaf"}),i._$AH=s;else if(Wo(s)){if(Cr(s))throw Error("compiled templates are not supported");const n="lit-part "+zr(s);if(e.data!==n)throw Error("Hydration value mismatch: Unexpected TemplateResult rendered to part");{const a=Vt.prototype._$AC(s),l=new Er(a,i);o.push({type:"template-instance",instance:l,part:i,templatePartIndex:0,instancePartIndex:0,result:s}),i._$AH=l}}else Sr(s)?(o.push({part:i,type:"iterable",value:s,iterator:s[Symbol.iterator](),done:!1}),i._$AH=[]):(o.push({part:i,type:"leaf"}),i._$AH=s??"");return i},Lr=(t,e,o)=>{if(e===void 0)throw Error("unbalanced part marker");e._$AB=t;const r=o.pop();if(r.type==="iterable"&&!r.iterator.next().done)throw Error("unexpected longer than expected iterable");if(o.length>0)return o[o.length-1].part},Rr=(t,e,o)=>{const r=/lit-node (\d+)/.exec(t.data),s=parseInt(r[1]),i=t.nextElementSibling;if(i===null)throw Error("could not find node for attribute parts");i.removeAttribute("defer-hydration");const n=e[e.length-1];if(n.type!=="template-instance")throw Error("Hydration value mismatch: Primitive found where TemplateResult expected. This usually occurs due to conditional rendering that resulted in a different value or template being rendered between the server and client.");{const a=n.instance;for(;;){const l=a._$AD.parts[n.templatePartIndex];if(l===void 0||l.type!==Pt.ATTRIBUTE&&l.type!==Pt.ELEMENT||l.index!==s)break;if(l.type===Pt.ATTRIBUTE){const d=new l.ctor(i,l.name,l.strings,n.instance,o),u=kr(d)?n.result.values[n.instancePartIndex]:n.result.values,h=!(d.type===Pt.EVENT||d.type===Pt.PROPERTY);d._$AI(u,d,n.instancePartIndex,h),n.instancePartIndex+=l.strings.length-1,a._$AV.push(d)}else{const d=new Pr(i,n.instance,o);jo(d,n.result.values[n.instancePartIndex++]),a._$AV.push(d)}n.templatePartIndex++}}},lo=new WeakMap,zr=t=>{let e=lo.get(t.strings);if(e!==void 0)return e;const o=new Uint32Array(2).fill(5381);for(const s of t.strings)for(let i=0;i<s.length;i++)o[i%2]=33*o[i%2]^s.charCodeAt(i);const r=String.fromCharCode(...new Uint8Array(o.buffer));return e=btoa(r),lo.set(t.strings,e),e};globalThis.litElementHydrateSupport=({LitElement:t})=>{const e=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t),"observedAttributes").get;Object.defineProperty(t,"observedAttributes",{get(){return[...e.call(this),"defer-hydration"]}});const o=t.prototype.attributeChangedCallback;t.prototype.attributeChangedCallback=function(n,a,l){n==="defer-hydration"&&l===null&&r.call(this),o.call(this,n,a,l)};const r=t.prototype.connectedCallback;t.prototype.connectedCallback=function(){this.hasAttribute("defer-hydration")||r.call(this)};const s=t.prototype.createRenderRoot;t.prototype.createRenderRoot=function(){return this.shadowRoot?(this._$AG=!0,this.shadowRoot):s.call(this)};const i=Object.getPrototypeOf(t.prototype).update;t.prototype.update=function(n){const a=this.render();if(i.call(this,n),this._$AG){this._$AG=!1;for(const l of this.getAttributeNames())if(l.startsWith("hydrate-internals-")){const d=l.slice(18);this.removeAttribute(d),this.removeAttribute(l)}Tr(a,this.renderRoot,this.renderOptions)}else Uo(a,this.renderRoot,this.renderOptions)}};const Br="modulepreload",Dr=function(t){return"/litro/_litro/"+t},co={},ut=function(e,o,r){let s=Promise.resolve();if(o&&o.length>0){document.getElementsByTagName("link");const n=document.querySelector("meta[property=csp-nonce]"),a=(n==null?void 0:n.nonce)||(n==null?void 0:n.getAttribute("nonce"));s=Promise.allSettled(o.map(l=>{if(l=Dr(l),l in co)return;co[l]=!0;const d=l.endsWith(".css"),u=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${u}`))return;const h=document.createElement("link");if(h.rel=d?"stylesheet":Br,d||(h.as="script"),h.crossOrigin="",h.href=l,a&&h.setAttribute("nonce",a),document.head.appendChild(h),d)return new Promise((b,f)=>{h.addEventListener("load",b),h.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${l}`)))})}))}function i(n){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=n,window.dispatchEvent(a),!a.defaultPrevented)throw n}return s.then(n=>{for(const a of n||[])a.status==="rejected"&&i(a.reason);return e().catch(i)})};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ie=globalThis,je=ie.ShadowRoot&&(ie.ShadyCSS===void 0||ie.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,qe=Symbol(),uo=new WeakMap;let qo=class{constructor(e,o,r){if(this._$cssResult$=!0,r!==qe)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=o}get styleSheet(){let e=this.o;const o=this.t;if(je&&e===void 0){const r=o!==void 0&&o.length===1;r&&(e=uo.get(o)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&uo.set(o,e))}return e}toString(){return this.cssText}};const Ir=t=>new qo(typeof t=="string"?t:t+"",void 0,qe),M=(t,...e)=>{const o=t.length===1?t[0]:e.reduce((r,s,i)=>r+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[i+1],t[0]);return new qo(o,t,qe)},Mr=(t,e)=>{if(je)t.adoptedStyleSheets=e.map(o=>o instanceof CSSStyleSheet?o:o.styleSheet);else for(const o of e){const r=document.createElement("style"),s=ie.litNonce;s!==void 0&&r.setAttribute("nonce",s),r.textContent=o.cssText,t.appendChild(r)}},ho=je?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let o="";for(const r of e.cssRules)o+=r.cssText;return Ir(o)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Nr,defineProperty:Fr,getOwnPropertyDescriptor:Hr,getOwnPropertyNames:Vr,getOwnPropertySymbols:Ur,getPrototypeOf:Wr}=Object,pt=globalThis,po=pt.trustedTypes,jr=po?po.emptyScript:"",Ee=pt.reactiveElementPolyfillSupport,Yt=(t,e)=>t,de={toAttribute(t,e){switch(e){case Boolean:t=t?jr:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let o=t;switch(e){case Boolean:o=t!==null;break;case Number:o=t===null?null:Number(t);break;case Object:case Array:try{o=JSON.parse(t)}catch{o=null}}return o}},Ke=(t,e)=>!Nr(t,e),fo={attribute:!0,type:String,converter:de,reflect:!1,useDefault:!1,hasChanged:Ke};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),pt.litPropertyMetadata??(pt.litPropertyMetadata=new WeakMap);class Tt extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,o=fo){if(o.state&&(o.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((o=Object.create(o)).wrapped=!0),this.elementProperties.set(e,o),!o.noAccessor){const r=Symbol(),s=this.getPropertyDescriptor(e,r,o);s!==void 0&&Fr(this.prototype,e,s)}}static getPropertyDescriptor(e,o,r){const{get:s,set:i}=Hr(this.prototype,e)??{get(){return this[o]},set(n){this[o]=n}};return{get:s,set(n){const a=s==null?void 0:s.call(this);i==null||i.call(this,n),this.requestUpdate(e,a,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??fo}static _$Ei(){if(this.hasOwnProperty(Yt("elementProperties")))return;const e=Wr(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Yt("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Yt("properties"))){const o=this.properties,r=[...Vr(o),...Ur(o)];for(const s of r)this.createProperty(s,o[s])}const e=this[Symbol.metadata];if(e!==null){const o=litPropertyMetadata.get(e);if(o!==void 0)for(const[r,s]of o)this.elementProperties.set(r,s)}this._$Eh=new Map;for(const[o,r]of this.elementProperties){const s=this._$Eu(o,r);s!==void 0&&this._$Eh.set(s,o)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const o=[];if(Array.isArray(e)){const r=new Set(e.flat(1/0).reverse());for(const s of r)o.unshift(ho(s))}else e!==void 0&&o.push(ho(e));return o}static _$Eu(e,o){const r=o.attribute;return r===!1?void 0:typeof r=="string"?r:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(o=>this.enableUpdating=o),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(o=>o(this))}addController(e){var o;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((o=e.hostConnected)==null||o.call(e))}removeController(e){var o;(o=this._$EO)==null||o.delete(e)}_$E_(){const e=new Map,o=this.constructor.elementProperties;for(const r of o.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Mr(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(o=>{var r;return(r=o.hostConnected)==null?void 0:r.call(o)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(o=>{var r;return(r=o.hostDisconnected)==null?void 0:r.call(o)})}attributeChangedCallback(e,o,r){this._$AK(e,r)}_$ET(e,o){var i;const r=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,r);if(s!==void 0&&r.reflect===!0){const n=(((i=r.converter)==null?void 0:i.toAttribute)!==void 0?r.converter:de).toAttribute(o,r.type);this._$Em=e,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(e,o){var i,n;const r=this.constructor,s=r._$Eh.get(e);if(s!==void 0&&this._$Em!==s){const a=r.getPropertyOptions(s),l=typeof a.converter=="function"?{fromAttribute:a.converter}:((i=a.converter)==null?void 0:i.fromAttribute)!==void 0?a.converter:de;this._$Em=s;const d=l.fromAttribute(o,a.type);this[s]=d??((n=this._$Ej)==null?void 0:n.get(s))??d,this._$Em=null}}requestUpdate(e,o,r,s=!1,i){var n;if(e!==void 0){const a=this.constructor;if(s===!1&&(i=this[e]),r??(r=a.getPropertyOptions(e)),!((r.hasChanged??Ke)(i,o)||r.useDefault&&r.reflect&&i===((n=this._$Ej)==null?void 0:n.get(e))&&!this.hasAttribute(a._$Eu(e,r))))return;this.C(e,o,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,o,{useDefault:r,reflect:s,wrapped:i},n){r&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,n??o??this[e]),i!==!0||n!==void 0)||(this._$AL.has(e)||(this.hasUpdated||r||(o=void 0),this._$AL.set(e,o)),s===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(o){Promise.reject(o)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var r;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[i,n]of this._$Ep)this[i]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,n]of s){const{wrapped:a}=n,l=this[i];a!==!0||this._$AL.has(i)||l===void 0||this.C(i,void 0,n,l)}}let e=!1;const o=this._$AL;try{e=this.shouldUpdate(o),e?(this.willUpdate(o),(r=this._$EO)==null||r.forEach(s=>{var i;return(i=s.hostUpdate)==null?void 0:i.call(s)}),this.update(o)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(o)}willUpdate(e){}_$AE(e){var o;(o=this._$EO)==null||o.forEach(r=>{var s;return(s=r.hostUpdated)==null?void 0:s.call(r)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(o=>this._$ET(o,this[o]))),this._$EM()}updated(e){}firstUpdated(e){}}Tt.elementStyles=[],Tt.shadowRootOptions={mode:"open"},Tt[Yt("elementProperties")]=new Map,Tt[Yt("finalized")]=new Map,Ee==null||Ee({ReactiveElement:Tt}),(pt.reactiveElementVersions??(pt.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const At=globalThis;let Ct=class extends Tt{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var o;const e=super.createRenderRoot();return(o=this.renderOptions).renderBefore??(o.renderBefore=e.firstChild),e}update(e){const o=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Uo(o,this.renderRoot,this.renderOptions)}connectedCallback(){var e;super.connectedCallback(),(e=this._$Do)==null||e.setConnected(!0)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._$Do)==null||e.setConnected(!1)}render(){return ft}};var zo;Ct._$litElement$=!0,Ct.finalized=!0,(zo=At.litElementHydrateSupport)==null||zo.call(At,{LitElement:Ct});const Se=At.litElementPolyfillSupport;Se==null||Se({LitElement:Ct});(At.litElementVersions??(At.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ko=t=>(e,o)=>{o!==void 0?o.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const qr={attribute:!0,type:String,converter:de,reflect:!1,hasChanged:Ke},Kr=(t=qr,e,o)=>{const{kind:r,metadata:s}=o;let i=globalThis.litPropertyMetadata.get(s);if(i===void 0&&globalThis.litPropertyMetadata.set(s,i=new Map),r==="setter"&&((t=Object.create(t)).wrapped=!0),i.set(o.name,t),r==="accessor"){const{name:n}=o;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(n,l,t,!0,a)},init(a){return a!==void 0&&this.C(n,void 0,t,a),a}}}if(r==="setter"){const{name:n}=o;return function(a){const l=this[n];e.call(this,a),this.requestUpdate(n,l,t,!0,a)}}throw Error("Unsupported decorator location: "+r)};function p(t){return(e,o)=>typeof o=="object"?Kr(t,e,o):((r,s,i)=>{const n=s.hasOwnProperty(i);return s.constructor.createProperty(i,r),n?Object.getOwnPropertyDescriptor(s,i):void 0})(t,e,o)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function it(t){return p({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Yr(t){return(e,o)=>{const r=typeof e=="function"?e:e[o];Object.assign(r,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Xr=(t,e,o)=>(o.configurable=!0,o.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(t,e,o),o);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function C(t,e){return(o,r,s)=>{const i=n=>{var a;return((a=n.renderRoot)==null?void 0:a.querySelector(t))??null};return Xr(o,r,{get(){return i(this)}})}}var Gr=Object.getOwnPropertyDescriptor,Zr=(t,e,o,r)=>{for(var s=r>1?void 0:r?Gr(e,o):e,i=t.length-1,n;i>=0;i--)(n=t[i])&&(s=n(s)||s);return s};let bo=class extends Ct{constructor(){super(...arguments),this._routes=[]}createRenderRoot(){return this}get routes(){return this._routes}set routes(t){this._routes=t,this.router&&this.router.setRoutes(t)}async firstUpdated(){const{LitroRouter:t}=await ut(async()=>{const{LitroRouter:e}=await import("./assets/index-BzYY-J9p.js");return{LitroRouter:e}},[]);this.router=new t(this),this.router.setRoutes(this._routes)}};bo=Zr([Ko("litro-outlet")],bo);var Jr=Object.getOwnPropertyDescriptor,Qr=(t,e,o,r)=>{for(var s=r>1?void 0:r?Jr(e,o):e,i=t.length-1,n;i>=0;i--)(n=t[i])&&(s=n(s)||s);return s};let De=class extends Ct{constructor(){super(...arguments),this.href="",this.target="",this.rel="",this._clickHandler=t=>{this.target||t.metaKey||t.ctrlKey||t.shiftKey||t.altKey||this.href.startsWith("/")&&(t.preventDefault(),ut(async()=>{const{LitroRouter:e}=await import("./assets/index-BzYY-J9p.js");return{LitroRouter:e}},[]).then(({LitroRouter:e})=>e.go(this.href)))}}connectedCallback(){this.addEventListener("click",this._clickHandler,!0),super.connectedCallback()}disconnectedCallback(){this.removeEventListener("click",this._clickHandler,!0),super.disconnectedCallback()}render(){return T`<a
      href=${this.href}
      target=${this.target}
      rel=${this.rel}
    ><slot></slot></a>`}};De.properties={href:{type:String},target:{type:String},rel:{type:String}};De=Qr([Ko("litro-link")],De);var ts=M`
  :host {
    --track-width: 2px;
    --track-color: rgb(128 128 128 / 25%);
    --indicator-color: var(--sl-color-primary-600);
    --speed: 2s;

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex: none;
  }

  .spinner {
    flex: 1 1 auto;
    height: 100%;
    width: 100%;
  }

  .spinner__track,
  .spinner__indicator {
    fill: none;
    stroke-width: var(--track-width);
    r: calc(0.5em - var(--track-width) / 2);
    cx: 0.5em;
    cy: 0.5em;
    transform-origin: 50% 50%;
  }

  .spinner__track {
    stroke: var(--track-color);
    transform-origin: 0% 0%;
  }

  .spinner__indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: 150% 75%;
    animation: spin var(--speed) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      stroke-dasharray: 0.05em, 3em;
    }

    50% {
      transform: rotate(450deg);
      stroke-dasharray: 1.375em, 1.375em;
    }

    100% {
      transform: rotate(1080deg);
      stroke-dasharray: 0.05em, 3em;
    }
  }
`;const Ie=new Set,Ot=new Map;let xt,Ye="ltr",Xe="en";const Yo=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Yo){const t=new MutationObserver(Go);Ye=document.documentElement.dir||"ltr",Xe=document.documentElement.lang||navigator.language,t.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Xo(...t){t.map(e=>{const o=e.$code.toLowerCase();Ot.has(o)?Ot.set(o,Object.assign(Object.assign({},Ot.get(o)),e)):Ot.set(o,e),xt||(xt=e)}),Go()}function Go(){Yo&&(Ye=document.documentElement.dir||"ltr",Xe=document.documentElement.lang||navigator.language),[...Ie.keys()].map(t=>{typeof t.requestUpdate=="function"&&t.requestUpdate()})}let es=class{constructor(e){this.host=e,this.host.addController(this)}hostConnected(){Ie.add(this.host)}hostDisconnected(){Ie.delete(this.host)}dir(){return`${this.host.dir||Ye}`.toLowerCase()}lang(){return`${this.host.lang||Xe}`.toLowerCase()}getTranslationData(e){var o,r;const s=new Intl.Locale(e.replace(/_/g,"-")),i=s==null?void 0:s.language.toLowerCase(),n=(r=(o=s==null?void 0:s.region)===null||o===void 0?void 0:o.toLowerCase())!==null&&r!==void 0?r:"",a=Ot.get(`${i}-${n}`),l=Ot.get(i);return{locale:s,language:i,region:n,primary:a,secondary:l}}exists(e,o){var r;const{primary:s,secondary:i}=this.getTranslationData((r=o.lang)!==null&&r!==void 0?r:this.lang());return o=Object.assign({includeFallback:!1},o),!!(s&&s[e]||i&&i[e]||o.includeFallback&&xt&&xt[e])}term(e,...o){const{primary:r,secondary:s}=this.getTranslationData(this.lang());let i;if(r&&r[e])i=r[e];else if(s&&s[e])i=s[e];else if(xt&&xt[e])i=xt[e];else return console.error(`No translation found for: ${String(e)}`),String(e);return typeof i=="function"?i(...o):i}date(e,o){return e=new Date(e),new Intl.DateTimeFormat(this.lang(),o).format(e)}number(e,o){return e=Number(e),isNaN(e)?"":new Intl.NumberFormat(this.lang(),o).format(e)}relativeTime(e,o,r){return new Intl.RelativeTimeFormat(this.lang(),r).format(e,o)}};var Zo={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(t,e)=>`Go to slide ${t} of ${e}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:t=>t===0?"No options selected":t===1?"1 option selected":`${t} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:t=>`Slide ${t}`,toggleColorFormat:"Toggle color format"};Xo(Zo);var os=Zo,vt=class extends es{};Xo(os);var V=M`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`,Jo=Object.defineProperty,rs=Object.defineProperties,ss=Object.getOwnPropertyDescriptor,is=Object.getOwnPropertyDescriptors,go=Object.getOwnPropertySymbols,ns=Object.prototype.hasOwnProperty,as=Object.prototype.propertyIsEnumerable,Qo=t=>{throw TypeError(t)},mo=(t,e,o)=>e in t?Jo(t,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):t[e]=o,nt=(t,e)=>{for(var o in e||(e={}))ns.call(e,o)&&mo(t,o,e[o]);if(go)for(var o of go(e))as.call(e,o)&&mo(t,o,e[o]);return t},Jt=(t,e)=>rs(t,is(e)),c=(t,e,o,r)=>{for(var s=r>1?void 0:r?ss(e,o):e,i=t.length-1,n;i>=0;i--)(n=t[i])&&(s=(r?n(e,o,s):n(s))||s);return r&&s&&Jo(e,o,s),s},tr=(t,e,o)=>e.has(t)||Qo("Cannot "+o),ls=(t,e,o)=>(tr(t,e,"read from private field"),e.get(t)),cs=(t,e,o)=>e.has(t)?Qo("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,o),ds=(t,e,o,r)=>(tr(t,e,"write to private field"),e.set(t,o),o),ne,O=class extends Ct{constructor(){super(),cs(this,ne,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([t,e])=>{this.constructor.define(t,e)})}emit(t,e){const o=new CustomEvent(t,nt({bubbles:!0,cancelable:!1,composed:!0,detail:{}},e));return this.dispatchEvent(o),o}static define(t,e=this,o={}){const r=customElements.get(t);if(!r){try{customElements.define(t,e,o)}catch{customElements.define(t,class extends e{},o)}return}let s=" (unknown version)",i=s;"version"in e&&e.version&&(s=" v"+e.version),"version"in r&&r.version&&(i=" v"+r.version),!(s&&i&&s===i)&&console.warn(`Attempted to register <${t}>${s}, but <${t}>${i} has already been registered.`)}attributeChangedCallback(t,e,o){ls(this,ne)||(this.constructor.elementProperties.forEach((r,s)=>{r.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),ds(this,ne,!0)),super.attributeChangedCallback(t,e,o)}willUpdate(t){super.willUpdate(t),this.initialReflectedProperties.forEach((e,o)=>{t.has(o)&&this[o]==null&&(this[o]=e)})}};ne=new WeakMap;O.version="2.20.1";O.dependencies={};c([p()],O.prototype,"dir",2);c([p()],O.prototype,"lang",2);var er=class extends O{constructor(){super(...arguments),this.localize=new vt(this)}render(){return T`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};er.styles=[V,ts];var Ut=new WeakMap,Wt=new WeakMap,jt=new WeakMap,Pe=new WeakSet,oe=new WeakMap,us=class{constructor(t,e){this.handleFormData=o=>{const r=this.options.disabled(this.host),s=this.options.name(this.host),i=this.options.value(this.host),n=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!r&&!n&&typeof s=="string"&&s.length>0&&typeof i<"u"&&(Array.isArray(i)?i.forEach(a=>{o.formData.append(s,a.toString())}):o.formData.append(s,i.toString()))},this.handleFormSubmit=o=>{var r;const s=this.options.disabled(this.host),i=this.options.reportValidity;this.form&&!this.form.noValidate&&((r=Ut.get(this.form))==null||r.forEach(n=>{this.setUserInteracted(n,!0)})),this.form&&!this.form.noValidate&&!s&&!i(this.host)&&(o.preventDefault(),o.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),oe.set(this.host,[])},this.handleInteraction=o=>{const r=oe.get(this.host);r.includes(o.type)||r.push(o.type),r.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const o=this.form.querySelectorAll("*");for(const r of o)if(typeof r.checkValidity=="function"&&!r.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const o=this.form.querySelectorAll("*");for(const r of o)if(typeof r.reportValidity=="function"&&!r.reportValidity())return!1}return!0},(this.host=t).addController(this),this.options=nt({form:o=>{const r=o.form;if(r){const i=o.getRootNode().querySelector(`#${r}`);if(i)return i}return o.closest("form")},name:o=>o.name,value:o=>o.value,defaultValue:o=>o.defaultValue,disabled:o=>{var r;return(r=o.disabled)!=null?r:!1},reportValidity:o=>typeof o.reportValidity=="function"?o.reportValidity():!0,checkValidity:o=>typeof o.checkValidity=="function"?o.checkValidity():!0,setValue:(o,r)=>o.value=r,assumeInteractionOn:["sl-input"]},e)}hostConnected(){const t=this.options.form(this.host);t&&this.attachForm(t),oe.set(this.host,[]),this.options.assumeInteractionOn.forEach(e=>{this.host.addEventListener(e,this.handleInteraction)})}hostDisconnected(){this.detachForm(),oe.delete(this.host),this.options.assumeInteractionOn.forEach(t=>{this.host.removeEventListener(t,this.handleInteraction)})}hostUpdated(){const t=this.options.form(this.host);t||this.detachForm(),t&&this.form!==t&&(this.detachForm(),this.attachForm(t)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(t){t?(this.form=t,Ut.has(this.form)?Ut.get(this.form).add(this.host):Ut.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),Wt.has(this.form)||(Wt.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),jt.has(this.form)||(jt.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const t=Ut.get(this.form);t&&(t.delete(this.host),t.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),Wt.has(this.form)&&(this.form.reportValidity=Wt.get(this.form),Wt.delete(this.form)),jt.has(this.form)&&(this.form.checkValidity=jt.get(this.form),jt.delete(this.form)),this.form=void 0))}setUserInteracted(t,e){e?Pe.add(t):Pe.delete(t),t.requestUpdate()}doAction(t,e){if(this.form){const o=document.createElement("button");o.type=t,o.style.position="absolute",o.style.width="0",o.style.height="0",o.style.clipPath="inset(50%)",o.style.overflow="hidden",o.style.whiteSpace="nowrap",e&&(o.name=e.name,o.value=e.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(r=>{e.hasAttribute(r)&&o.setAttribute(r,e.getAttribute(r))})),this.form.append(o),o.click(),o.remove()}}getForm(){var t;return(t=this.form)!=null?t:null}reset(t){this.doAction("reset",t)}submit(t){this.doAction("submit",t)}setValidity(t){const e=this.host,o=!!Pe.has(e),r=!!e.required;e.toggleAttribute("data-required",r),e.toggleAttribute("data-optional",!r),e.toggleAttribute("data-invalid",!t),e.toggleAttribute("data-valid",t),e.toggleAttribute("data-user-invalid",!t&&o),e.toggleAttribute("data-user-valid",t&&o)}updateValidity(){const t=this.host;this.setValidity(t.validity.valid)}emitInvalidEvent(t){const e=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});t||e.preventDefault(),this.host.dispatchEvent(e)||t==null||t.preventDefault()}},Ge=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Jt(nt({},Ge),{valid:!1,valueMissing:!0}));Object.freeze(Jt(nt({},Ge),{valid:!1,customError:!0}));var hs=M`
  :host {
    display: inline-block;
    position: relative;
    width: auto;
    cursor: pointer;
  }

  .button {
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    border-style: solid;
    border-width: var(--sl-input-border-width);
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-font-weight-semibold);
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    padding: 0;
    transition:
      var(--sl-transition-x-fast) background-color,
      var(--sl-transition-x-fast) color,
      var(--sl-transition-x-fast) border,
      var(--sl-transition-x-fast) box-shadow;
    cursor: inherit;
  }

  .button::-moz-focus-inner {
    border: 0;
  }

  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* When disabled, prevent mouse events from bubbling up from children */
  .button--disabled * {
    pointer-events: none;
  }

  .button__prefix,
  .button__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .button__label {
    display: inline-block;
  }

  .button__label::slotted(sl-icon) {
    vertical-align: -2px;
  }

  /*
   * Standard buttons
   */

  /* Default */
  .button--standard.button--default {
    background-color: var(--sl-color-neutral-0);
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--standard.button--default:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-300);
    color: var(--sl-color-primary-700);
  }

  .button--standard.button--default:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-100);
    border-color: var(--sl-color-primary-400);
    color: var(--sl-color-primary-700);
  }

  /* Primary */
  .button--standard.button--primary {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-500);
    border-color: var(--sl-color-primary-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--standard.button--success {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:hover:not(.button--disabled) {
    background-color: var(--sl-color-success-500);
    border-color: var(--sl-color-success-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:active:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--standard.button--neutral {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:hover:not(.button--disabled) {
    background-color: var(--sl-color-neutral-500);
    border-color: var(--sl-color-neutral-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:active:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--standard.button--warning {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }
  .button--standard.button--warning:hover:not(.button--disabled) {
    background-color: var(--sl-color-warning-500);
    border-color: var(--sl-color-warning-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--warning:active:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--standard.button--danger {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:hover:not(.button--disabled) {
    background-color: var(--sl-color-danger-500);
    border-color: var(--sl-color-danger-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:active:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /*
   * Outline buttons
   */

  .button--outline {
    background: none;
    border: solid 1px;
  }

  /* Default */
  .button--outline.button--default {
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--outline.button--default:hover:not(.button--disabled),
  .button--outline.button--default.button--checked:not(.button--disabled) {
    border-color: var(--sl-color-primary-600);
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--default:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Primary */
  .button--outline.button--primary {
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-primary-600);
  }

  .button--outline.button--primary:hover:not(.button--disabled),
  .button--outline.button--primary.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--primary:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--outline.button--success {
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-success-600);
  }

  .button--outline.button--success:hover:not(.button--disabled),
  .button--outline.button--success.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--success:active:not(.button--disabled) {
    border-color: var(--sl-color-success-700);
    background-color: var(--sl-color-success-700);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--outline.button--neutral {
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-600);
  }

  .button--outline.button--neutral:hover:not(.button--disabled),
  .button--outline.button--neutral.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--neutral:active:not(.button--disabled) {
    border-color: var(--sl-color-neutral-700);
    background-color: var(--sl-color-neutral-700);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--outline.button--warning {
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-warning-600);
  }

  .button--outline.button--warning:hover:not(.button--disabled),
  .button--outline.button--warning.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--warning:active:not(.button--disabled) {
    border-color: var(--sl-color-warning-700);
    background-color: var(--sl-color-warning-700);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--outline.button--danger {
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-danger-600);
  }

  .button--outline.button--danger:hover:not(.button--disabled),
  .button--outline.button--danger.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--danger:active:not(.button--disabled) {
    border-color: var(--sl-color-danger-700);
    background-color: var(--sl-color-danger-700);
    color: var(--sl-color-neutral-0);
  }

  @media (forced-colors: active) {
    .button.button--outline.button--checked:not(.button--disabled) {
      outline: solid 2px transparent;
    }
  }

  /*
   * Text buttons
   */

  .button--text {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-600);
  }

  .button--text:hover:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:focus-visible:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:active:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-700);
  }

  /*
   * Size modifiers
   */

  .button--small {
    height: auto;
    min-height: var(--sl-input-height-small);
    font-size: var(--sl-button-font-size-small);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
  }

  .button--medium {
    height: auto;
    min-height: var(--sl-input-height-medium);
    font-size: var(--sl-button-font-size-medium);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
  }

  .button--large {
    height: auto;
    min-height: var(--sl-input-height-large);
    font-size: var(--sl-button-font-size-large);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
  }

  /*
   * Pill modifier
   */

  .button--pill.button--small {
    border-radius: var(--sl-input-height-small);
  }

  .button--pill.button--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .button--pill.button--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Circle modifier
   */

  .button--circle {
    padding-left: 0;
    padding-right: 0;
  }

  .button--circle.button--small {
    width: var(--sl-input-height-small);
    border-radius: 50%;
  }

  .button--circle.button--medium {
    width: var(--sl-input-height-medium);
    border-radius: 50%;
  }

  .button--circle.button--large {
    width: var(--sl-input-height-large);
    border-radius: 50%;
  }

  .button--circle .button__prefix,
  .button--circle .button__suffix,
  .button--circle .button__caret {
    display: none;
  }

  /*
   * Caret modifier
   */

  .button--caret .button__suffix {
    display: none;
  }

  .button--caret .button__caret {
    height: auto;
  }

  /*
   * Loading modifier
   */

  .button--loading {
    position: relative;
    cursor: wait;
  }

  .button--loading .button__prefix,
  .button--loading .button__label,
  .button--loading .button__suffix,
  .button--loading .button__caret {
    visibility: hidden;
  }

  .button--loading sl-spinner {
    --indicator-color: currentColor;
    position: absolute;
    font-size: 1em;
    height: 1em;
    width: 1em;
    top: calc(50% - 0.5em);
    left: calc(50% - 0.5em);
  }

  /*
   * Badges
   */

  .button ::slotted(sl-badge) {
    position: absolute;
    top: 0;
    right: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  .button--rtl ::slotted(sl-badge) {
    right: auto;
    left: 0;
    translate: -50% -50%;
  }

  /*
   * Button spacing
   */

  .button--has-label.button--small .button__label {
    padding: 0 var(--sl-spacing-small);
  }

  .button--has-label.button--medium .button__label {
    padding: 0 var(--sl-spacing-medium);
  }

  .button--has-label.button--large .button__label {
    padding: 0 var(--sl-spacing-large);
  }

  .button--has-prefix.button--small {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--small .button__label {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--medium {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--medium .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-suffix.button--small,
  .button--caret.button--small {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--small .button__label,
  .button--caret.button--small .button__label {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--medium,
  .button--caret.button--medium {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--medium .button__label,
  .button--caret.button--medium .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large,
  .button--caret.button--large {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large .button__label,
  .button--caret.button--large .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  /*
   * Button groups support a variety of button types (e.g. buttons with tooltips, buttons as dropdown triggers, etc.).
   * This means buttons aren't always direct descendants of the button group, thus we can't target them with the
   * ::slotted selector. To work around this, the button group component does some magic to add these special classes to
   * buttons and we style them here instead.
   */

  :host([data-sl-button-group__button--first]:not([data-sl-button-group__button--last])) .button {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :host([data-sl-button-group__button--inner]) .button {
    border-radius: 0;
  }

  :host([data-sl-button-group__button--last]:not([data-sl-button-group__button--first])) .button {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  /* All except the first */
  :host([data-sl-button-group__button]:not([data-sl-button-group__button--first])) {
    margin-inline-start: calc(-1 * var(--sl-input-border-width));
  }

  /* Add a visual separator between solid buttons */
  :host(
      [data-sl-button-group__button]:not(
          [data-sl-button-group__button--first],
          [data-sl-button-group__button--radio],
          [variant='default']
        ):not(:hover)
    )
    .button:after {
    content: '';
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    border-left: solid 1px rgb(128 128 128 / 33%);
    mix-blend-mode: multiply;
  }

  /* Bump hovered, focused, and checked buttons up so their focus ring isn't clipped */
  :host([data-sl-button-group__button--hover]) {
    z-index: 1;
  }

  /* Focus and checked are always on top */
  :host([data-sl-button-group__button--focus]),
  :host([data-sl-button-group__button][checked]) {
    z-index: 2;
  }
`,ps=class{constructor(t,...e){this.slotNames=[],this.handleSlotChange=o=>{const r=o.target;(this.slotNames.includes("[default]")&&!r.name||r.name&&this.slotNames.includes(r.name))&&this.host.requestUpdate()},(this.host=t).addController(this),this.slotNames=e}hasDefaultSlot(){return[...this.host.childNodes].some(t=>{if(t.nodeType===t.TEXT_NODE&&t.textContent.trim()!=="")return!0;if(t.nodeType===t.ELEMENT_NODE){const e=t;if(e.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!e.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(t){return this.host.querySelector(`:scope > [slot="${t}"]`)!==null}test(t){return t==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(t)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},Me="";function Ne(t){Me=t}function fs(t=""){if(!Me){const e=[...document.getElementsByTagName("script")],o=e.find(r=>r.hasAttribute("data-shoelace"));if(o)Ne(o.getAttribute("data-shoelace"));else{const r=e.find(i=>/shoelace(\.min)?\.js($|\?)/.test(i.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(i.src));let s="";r&&(s=r.getAttribute("src")),Ne(s.split("/").slice(0,-1).join("/"))}}return Me.replace(/\/$/,"")+(t?`/${t.replace(/^\//,"")}`:"")}var bs={name:"default",resolver:t=>fs(`assets/icons/${t}.svg`)},gs=bs,vo={caret:`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,check:`
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"chevron-down":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,"chevron-left":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,"chevron-right":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,copy:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,eye:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,"eye-slash":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,eyedropper:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,"grip-vertical":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,indeterminate:`
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"person-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,"play-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,"pause-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,radio:`
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,"star-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,"x-lg":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,"x-circle-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `},ms={name:"system",resolver:t=>t in vo?`data:image/svg+xml,${encodeURIComponent(vo[t])}`:""},vs=ms,ys=[gs,vs],Fe=[];function ws(t){Fe.push(t)}function _s(t){Fe=Fe.filter(e=>e!==t)}function yo(t){return ys.find(e=>e.name===t)}var xs=M`
  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;function U(t,e){const o=nt({waitUntilFirstUpdate:!1},e);return(r,s)=>{const{update:i}=r,n=Array.isArray(t)?t:[t];r.update=function(a){n.forEach(l=>{const d=l;if(a.has(d)){const u=a.get(d),h=this[d];u!==h&&(!o.waitUntilFirstUpdate||this.hasUpdated)&&this[s](u,h)}}),i.call(this,a)}}}var qt=Symbol(),re=Symbol(),Te,Oe=new Map,W=class extends O{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(t,e){var o;let r;if(e!=null&&e.spriteSheet)return this.svg=T`<svg part="svg">
        <use part="use" href="${t}"></use>
      </svg>`,this.svg;try{if(r=await fetch(t,{mode:"cors"}),!r.ok)return r.status===410?qt:re}catch{return re}try{const s=document.createElement("div");s.innerHTML=await r.text();const i=s.firstElementChild;if(((o=i==null?void 0:i.tagName)==null?void 0:o.toLowerCase())!=="svg")return qt;Te||(Te=new DOMParser);const a=Te.parseFromString(i.outerHTML,"text/html").body.querySelector("svg");return a?(a.part.add("svg"),document.adoptNode(a)):qt}catch{return qt}}connectedCallback(){super.connectedCallback(),ws(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),_s(this)}getIconSource(){const t=yo(this.library);return this.name&&t?{url:t.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var t;const{url:e,fromLibrary:o}=this.getIconSource(),r=o?yo(this.library):void 0;if(!e){this.svg=null;return}let s=Oe.get(e);if(s||(s=this.resolveIcon(e,r),Oe.set(e,s)),!this.initialRender)return;const i=await s;if(i===re&&Oe.delete(e),e===this.getIconSource().url){if(Wo(i)){if(this.svg=i,r){await this.updateComplete;const n=this.shadowRoot.querySelector("[part='svg']");typeof r.mutator=="function"&&n&&r.mutator(n)}return}switch(i){case re:case qt:this.svg=null,this.emit("sl-error");break;default:this.svg=i.cloneNode(!0),(t=r==null?void 0:r.mutator)==null||t.call(r,this.svg),this.emit("sl-load")}}}render(){return this.svg}};W.styles=[V,xs];c([it()],W.prototype,"svg",2);c([p({reflect:!0})],W.prototype,"name",2);c([p()],W.prototype,"src",2);c([p()],W.prototype,"label",2);c([p({reflect:!0})],W.prototype,"library",2);c([U("label")],W.prototype,"handleLabelChange",1);c([U(["name","src","library"])],W.prototype,"setIcon",1);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const F=xr(class extends $r{constructor(t){var e;if(super(t),t.type!==Pt.ATTRIBUTE||t.name!=="class"||((e=t.strings)==null?void 0:e.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter(e=>t[e]).join(" ")+" "}update(t,[e]){var r,s;if(this.st===void 0){this.st=new Set,t.strings!==void 0&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in e)e[i]&&!((r=this.nt)!=null&&r.has(i))&&this.st.add(i);return this.render(e)}const o=t.element.classList;for(const i of this.st)i in e||(o.remove(i),this.st.delete(i));for(const i in e){const n=!!e[i];n===this.st.has(i)||(s=this.nt)!=null&&s.has(i)||(n?(o.add(i),this.st.add(i)):(o.remove(i),this.st.delete(i)))}return ft}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const or=Symbol.for(""),$s=t=>{if((t==null?void 0:t.r)===or)return t==null?void 0:t._$litStatic$},ue=(t,...e)=>({_$litStatic$:e.reduce((o,r,s)=>o+(i=>{if(i._$litStatic$!==void 0)return i._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${i}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(r)+t[s+1],t[0]),r:or}),wo=new Map,As=t=>(e,...o)=>{const r=o.length;let s,i;const n=[],a=[];let l,d=0,u=!1;for(;d<r;){for(l=e[d];d<r&&(i=o[d],(s=$s(i))!==void 0);)l+=s+e[++d],u=!0;d!==r&&a.push(i),n.push(l),d++}if(d===r&&n.push(e[r]),u){const h=n.join("$$lit$$");(e=wo.get(h))===void 0&&(n.raw=n,wo.set(h,e=n)),o=a}return t(e,...o)},ae=As(T);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=t=>t??S;var _=class extends O{constructor(){super(...arguments),this.formControlController=new us(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new ps(this,"[default]","prefix","suffix"),this.localize=new vt(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Ge}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(t){this.isButton()&&(this.button.setCustomValidity(t),this.formControlController.updateValidity())}render(){const t=this.isLink(),e=t?ue`a`:ue`button`;return ae`
      <${e}
        part="base"
        class=${F({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${E(t?void 0:this.disabled)}
        type=${E(t?void 0:this.type)}
        title=${this.title}
        name=${E(t?void 0:this.name)}
        value=${E(t?void 0:this.value)}
        href=${E(t&&!this.disabled?this.href:void 0)}
        target=${E(t?this.target:void 0)}
        download=${E(t?this.download:void 0)}
        rel=${E(t?this.rel:void 0)}
        role=${E(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @invalid=${this.isButton()?this.handleInvalid:null}
        @click=${this.handleClick}
      >
        <slot name="prefix" part="prefix" class="button__prefix"></slot>
        <slot part="label" class="button__label"></slot>
        <slot name="suffix" part="suffix" class="button__suffix"></slot>
        ${this.caret?ae` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?ae`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${e}>
    `}};_.styles=[V,hs];_.dependencies={"sl-icon":W,"sl-spinner":er};c([C(".button")],_.prototype,"button",2);c([it()],_.prototype,"hasFocus",2);c([it()],_.prototype,"invalid",2);c([p()],_.prototype,"title",2);c([p({reflect:!0})],_.prototype,"variant",2);c([p({reflect:!0})],_.prototype,"size",2);c([p({type:Boolean,reflect:!0})],_.prototype,"caret",2);c([p({type:Boolean,reflect:!0})],_.prototype,"disabled",2);c([p({type:Boolean,reflect:!0})],_.prototype,"loading",2);c([p({type:Boolean,reflect:!0})],_.prototype,"outline",2);c([p({type:Boolean,reflect:!0})],_.prototype,"pill",2);c([p({type:Boolean,reflect:!0})],_.prototype,"circle",2);c([p()],_.prototype,"type",2);c([p()],_.prototype,"name",2);c([p()],_.prototype,"value",2);c([p()],_.prototype,"href",2);c([p()],_.prototype,"target",2);c([p()],_.prototype,"rel",2);c([p()],_.prototype,"download",2);c([p()],_.prototype,"form",2);c([p({attribute:"formaction"})],_.prototype,"formAction",2);c([p({attribute:"formenctype"})],_.prototype,"formEnctype",2);c([p({attribute:"formmethod"})],_.prototype,"formMethod",2);c([p({attribute:"formnovalidate",type:Boolean})],_.prototype,"formNoValidate",2);c([p({attribute:"formtarget"})],_.prototype,"formTarget",2);c([U("disabled",{waitUntilFirstUpdate:!0})],_.prototype,"handleDisabledChange",1);_.define("sl-button");W.define("sl-icon");var Cs=M`
  :host {
    display: inline-flex;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: max(12px, 0.75em);
    font-weight: var(--sl-font-weight-semibold);
    letter-spacing: var(--sl-letter-spacing-normal);
    line-height: 1;
    border-radius: var(--sl-border-radius-small);
    border: solid 1px var(--sl-color-neutral-0);
    white-space: nowrap;
    padding: 0.35em 0.6em;
    user-select: none;
    -webkit-user-select: none;
    cursor: inherit;
  }

  /* Variant modifiers */
  .badge--primary {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--success {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--neutral {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--warning {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .badge--danger {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /* Pill modifier */
  .badge--pill {
    border-radius: var(--sl-border-radius-pill);
  }

  /* Pulse modifier */
  .badge--pulse {
    animation: pulse 1.5s infinite;
  }

  .badge--pulse.badge--primary {
    --pulse-color: var(--sl-color-primary-600);
  }

  .badge--pulse.badge--success {
    --pulse-color: var(--sl-color-success-600);
  }

  .badge--pulse.badge--neutral {
    --pulse-color: var(--sl-color-neutral-600);
  }

  .badge--pulse.badge--warning {
    --pulse-color: var(--sl-color-warning-600);
  }

  .badge--pulse.badge--danger {
    --pulse-color: var(--sl-color-danger-600);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 var(--pulse-color);
    }
    70% {
      box-shadow: 0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }
`,Qt=class extends O{constructor(){super(...arguments),this.variant="primary",this.pill=!1,this.pulse=!1}render(){return T`
      <span
        part="base"
        class=${F({badge:!0,"badge--primary":this.variant==="primary","badge--success":this.variant==="success","badge--neutral":this.variant==="neutral","badge--warning":this.variant==="warning","badge--danger":this.variant==="danger","badge--pill":this.pill,"badge--pulse":this.pulse})}
        role="status"
      >
        <slot></slot>
      </span>
    `}};Qt.styles=[V,Cs];c([p({reflect:!0})],Qt.prototype,"variant",2);c([p({type:Boolean,reflect:!0})],Qt.prototype,"pill",2);c([p({type:Boolean,reflect:!0})],Qt.prototype,"pulse",2);Qt.define("sl-badge");var ks=M`
  :host {
    --max-width: 20rem;
    --hide-delay: 0ms;
    --show-delay: 150ms;

    display: contents;
  }

  .tooltip {
    --arrow-size: var(--sl-tooltip-arrow-size);
    --arrow-color: var(--sl-tooltip-background-color);
  }

  .tooltip::part(popup) {
    z-index: var(--sl-z-index-tooltip);
  }

  .tooltip[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .tooltip[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .tooltip[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .tooltip[placement^='right']::part(popup) {
    transform-origin: left;
  }

  .tooltip__body {
    display: block;
    width: max-content;
    max-width: var(--max-width);
    border-radius: var(--sl-tooltip-border-radius);
    background-color: var(--sl-tooltip-background-color);
    font-family: var(--sl-tooltip-font-family);
    font-size: var(--sl-tooltip-font-size);
    font-weight: var(--sl-tooltip-font-weight);
    line-height: var(--sl-tooltip-line-height);
    text-align: start;
    white-space: normal;
    color: var(--sl-tooltip-color);
    padding: var(--sl-tooltip-padding);
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
`,Es=M`
  :host {
    --arrow-color: var(--sl-color-neutral-1000);
    --arrow-size: 6px;

    /*
     * These properties are computed to account for the arrow's dimensions after being rotated 45º. The constant
     * 0.7071 is derived from sin(45), which is the diagonal size of the arrow's container after rotating.
     */
    --arrow-size-diagonal: calc(var(--arrow-size) * 0.7071);
    --arrow-padding-offset: calc(var(--arrow-size-diagonal) - var(--arrow-size));

    display: contents;
  }

  .popup {
    position: absolute;
    isolation: isolate;
    max-width: var(--auto-size-available-width, none);
    max-height: var(--auto-size-available-height, none);
  }

  .popup--fixed {
    position: fixed;
  }

  .popup:not(.popup--active) {
    display: none;
  }

  .popup__arrow {
    position: absolute;
    width: calc(var(--arrow-size-diagonal) * 2);
    height: calc(var(--arrow-size-diagonal) * 2);
    rotate: 45deg;
    background: var(--arrow-color);
    z-index: -1;
  }

  /* Hover bridge */
  .popup-hover-bridge:not(.popup-hover-bridge--visible) {
    display: none;
  }

  .popup-hover-bridge {
    position: fixed;
    z-index: calc(var(--sl-z-index-dropdown) - 1);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--hover-bridge-top-left-x, 0) var(--hover-bridge-top-left-y, 0),
      var(--hover-bridge-top-right-x, 0) var(--hover-bridge-top-right-y, 0),
      var(--hover-bridge-bottom-right-x, 0) var(--hover-bridge-bottom-right-y, 0),
      var(--hover-bridge-bottom-left-x, 0) var(--hover-bridge-bottom-left-y, 0)
    );
  }
`;const bt=Math.min,N=Math.max,he=Math.round,se=Math.floor,tt=t=>({x:t,y:t}),Ss={left:"right",right:"left",bottom:"top",top:"bottom"};function He(t,e,o){return N(t,bt(e,o))}function Dt(t,e){return typeof t=="function"?t(e):t}function gt(t){return t.split("-")[0]}function It(t){return t.split("-")[1]}function rr(t){return t==="x"?"y":"x"}function Ze(t){return t==="y"?"height":"width"}function st(t){const e=t[0];return e==="t"||e==="b"?"y":"x"}function Je(t){return rr(st(t))}function Ps(t,e,o){o===void 0&&(o=!1);const r=It(t),s=Je(t),i=Ze(s);let n=s==="x"?r===(o?"end":"start")?"right":"left":r==="start"?"bottom":"top";return e.reference[i]>e.floating[i]&&(n=pe(n)),[n,pe(n)]}function Ts(t){const e=pe(t);return[Ve(t),e,Ve(e)]}function Ve(t){return t.includes("start")?t.replace("start","end"):t.replace("end","start")}const _o=["left","right"],xo=["right","left"],Os=["top","bottom"],Ls=["bottom","top"];function Rs(t,e,o){switch(t){case"top":case"bottom":return o?e?xo:_o:e?_o:xo;case"left":case"right":return e?Os:Ls;default:return[]}}function zs(t,e,o,r){const s=It(t);let i=Rs(gt(t),o==="start",r);return s&&(i=i.map(n=>n+"-"+s),e&&(i=i.concat(i.map(Ve)))),i}function pe(t){const e=gt(t);return Ss[e]+t.slice(e.length)}function Bs(t){return{top:0,right:0,bottom:0,left:0,...t}}function sr(t){return typeof t!="number"?Bs(t):{top:t,right:t,bottom:t,left:t}}function fe(t){const{x:e,y:o,width:r,height:s}=t;return{width:r,height:s,top:o,left:e,right:e+r,bottom:o+s,x:e,y:o}}function $o(t,e,o){let{reference:r,floating:s}=t;const i=st(e),n=Je(e),a=Ze(n),l=gt(e),d=i==="y",u=r.x+r.width/2-s.width/2,h=r.y+r.height/2-s.height/2,b=r[a]/2-s[a]/2;let f;switch(l){case"top":f={x:u,y:r.y-s.height};break;case"bottom":f={x:u,y:r.y+r.height};break;case"right":f={x:r.x+r.width,y:h};break;case"left":f={x:r.x-s.width,y:h};break;default:f={x:r.x,y:r.y}}switch(It(e)){case"start":f[n]-=b*(o&&d?-1:1);break;case"end":f[n]+=b*(o&&d?-1:1);break}return f}async function Ds(t,e){var o;e===void 0&&(e={});const{x:r,y:s,platform:i,rects:n,elements:a,strategy:l}=t,{boundary:d="clippingAncestors",rootBoundary:u="viewport",elementContext:h="floating",altBoundary:b=!1,padding:f=0}=Dt(e,t),g=sr(f),y=a[b?h==="floating"?"reference":"floating":h],v=fe(await i.getClippingRect({element:(o=await(i.isElement==null?void 0:i.isElement(y)))==null||o?y:y.contextElement||await(i.getDocumentElement==null?void 0:i.getDocumentElement(a.floating)),boundary:d,rootBoundary:u,strategy:l})),w=h==="floating"?{x:r,y:s,width:n.floating.width,height:n.floating.height}:n.reference,x=await(i.getOffsetParent==null?void 0:i.getOffsetParent(a.floating)),A=await(i.isElement==null?void 0:i.isElement(x))?await(i.getScale==null?void 0:i.getScale(x))||{x:1,y:1}:{x:1,y:1},z=fe(i.convertOffsetParentRelativeRectToViewportRelativeRect?await i.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:w,offsetParent:x,strategy:l}):w);return{top:(v.top-z.top+g.top)/A.y,bottom:(z.bottom-v.bottom+g.bottom)/A.y,left:(v.left-z.left+g.left)/A.x,right:(z.right-v.right+g.right)/A.x}}const Is=50,Ms=async(t,e,o)=>{const{placement:r="bottom",strategy:s="absolute",middleware:i=[],platform:n}=o,a=n.detectOverflow?n:{...n,detectOverflow:Ds},l=await(n.isRTL==null?void 0:n.isRTL(e));let d=await n.getElementRects({reference:t,floating:e,strategy:s}),{x:u,y:h}=$o(d,r,l),b=r,f=0;const g={};for(let m=0;m<i.length;m++){const y=i[m];if(!y)continue;const{name:v,fn:w}=y,{x,y:A,data:z,reset:k}=await w({x:u,y:h,initialPlacement:r,placement:b,strategy:s,middlewareData:g,rects:d,platform:a,elements:{reference:t,floating:e}});u=x??u,h=A??h,g[v]={...g[v],...z},k&&f<Is&&(f++,typeof k=="object"&&(k.placement&&(b=k.placement),k.rects&&(d=k.rects===!0?await n.getElementRects({reference:t,floating:e,strategy:s}):k.rects),{x:u,y:h}=$o(d,b,l)),m=-1)}return{x:u,y:h,placement:b,strategy:s,middlewareData:g}},Ns=t=>({name:"arrow",options:t,async fn(e){const{x:o,y:r,placement:s,rects:i,platform:n,elements:a,middlewareData:l}=e,{element:d,padding:u=0}=Dt(t,e)||{};if(d==null)return{};const h=sr(u),b={x:o,y:r},f=Je(s),g=Ze(f),m=await n.getDimensions(d),y=f==="y",v=y?"top":"left",w=y?"bottom":"right",x=y?"clientHeight":"clientWidth",A=i.reference[g]+i.reference[f]-b[f]-i.floating[g],z=b[f]-i.reference[f],k=await(n.getOffsetParent==null?void 0:n.getOffsetParent(d));let B=k?k[x]:0;(!B||!await(n.isElement==null?void 0:n.isElement(k)))&&(B=a.floating[x]||i.floating[g]);const ot=A/2-z/2,J=B/2-m[g]/2-1,j=bt(h[v],J),lt=bt(h[w],J),Q=j,ct=B-m[g]-lt,D=B/2-m[g]/2+ot,yt=He(Q,D,ct),rt=!l.arrow&&It(s)!=null&&D!==yt&&i.reference[g]/2-(D<Q?j:lt)-m[g]/2<0,q=rt?D<Q?D-Q:D-ct:0;return{[f]:b[f]+q,data:{[f]:yt,centerOffset:D-yt-q,...rt&&{alignmentOffset:q}},reset:rt}}}),Fs=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var o,r;const{placement:s,middlewareData:i,rects:n,initialPlacement:a,platform:l,elements:d}=e,{mainAxis:u=!0,crossAxis:h=!0,fallbackPlacements:b,fallbackStrategy:f="bestFit",fallbackAxisSideDirection:g="none",flipAlignment:m=!0,...y}=Dt(t,e);if((o=i.arrow)!=null&&o.alignmentOffset)return{};const v=gt(s),w=st(a),x=gt(a)===a,A=await(l.isRTL==null?void 0:l.isRTL(d.floating)),z=b||(x||!m?[pe(a)]:Ts(a)),k=g!=="none";!b&&k&&z.push(...zs(a,m,g,A));const B=[a,...z],ot=await l.detectOverflow(e,y),J=[];let j=((r=i.flip)==null?void 0:r.overflows)||[];if(u&&J.push(ot[v]),h){const D=Ps(s,n,A);J.push(ot[D[0]],ot[D[1]])}if(j=[...j,{placement:s,overflows:J}],!J.every(D=>D<=0)){var lt,Q;const D=(((lt=i.flip)==null?void 0:lt.index)||0)+1,yt=B[D];if(yt&&(!(h==="alignment"?w!==st(yt):!1)||j.every(K=>st(K.placement)===w?K.overflows[0]>0:!0)))return{data:{index:D,overflows:j},reset:{placement:yt}};let rt=(Q=j.filter(q=>q.overflows[0]<=0).sort((q,K)=>q.overflows[1]-K.overflows[1])[0])==null?void 0:Q.placement;if(!rt)switch(f){case"bestFit":{var ct;const q=(ct=j.filter(K=>{if(k){const dt=st(K.placement);return dt===w||dt==="y"}return!0}).map(K=>[K.placement,K.overflows.filter(dt=>dt>0).reduce((dt,fr)=>dt+fr,0)]).sort((K,dt)=>K[1]-dt[1])[0])==null?void 0:ct[0];q&&(rt=q);break}case"initialPlacement":rt=a;break}if(s!==rt)return{reset:{placement:rt}}}return{}}}},Hs=new Set(["left","top"]);async function Vs(t,e){const{placement:o,platform:r,elements:s}=t,i=await(r.isRTL==null?void 0:r.isRTL(s.floating)),n=gt(o),a=It(o),l=st(o)==="y",d=Hs.has(n)?-1:1,u=i&&l?-1:1,h=Dt(e,t);let{mainAxis:b,crossAxis:f,alignmentAxis:g}=typeof h=="number"?{mainAxis:h,crossAxis:0,alignmentAxis:null}:{mainAxis:h.mainAxis||0,crossAxis:h.crossAxis||0,alignmentAxis:h.alignmentAxis};return a&&typeof g=="number"&&(f=a==="end"?g*-1:g),l?{x:f*u,y:b*d}:{x:b*d,y:f*u}}const Us=function(t){return t===void 0&&(t=0),{name:"offset",options:t,async fn(e){var o,r;const{x:s,y:i,placement:n,middlewareData:a}=e,l=await Vs(e,t);return n===((o=a.offset)==null?void 0:o.placement)&&(r=a.arrow)!=null&&r.alignmentOffset?{}:{x:s+l.x,y:i+l.y,data:{...l,placement:n}}}}},Ws=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:o,y:r,placement:s,platform:i}=e,{mainAxis:n=!0,crossAxis:a=!1,limiter:l={fn:v=>{let{x:w,y:x}=v;return{x:w,y:x}}},...d}=Dt(t,e),u={x:o,y:r},h=await i.detectOverflow(e,d),b=st(gt(s)),f=rr(b);let g=u[f],m=u[b];if(n){const v=f==="y"?"top":"left",w=f==="y"?"bottom":"right",x=g+h[v],A=g-h[w];g=He(x,g,A)}if(a){const v=b==="y"?"top":"left",w=b==="y"?"bottom":"right",x=m+h[v],A=m-h[w];m=He(x,m,A)}const y=l.fn({...e,[f]:g,[b]:m});return{...y,data:{x:y.x-o,y:y.y-r,enabled:{[f]:n,[b]:a}}}}}},js=function(t){return t===void 0&&(t={}),{name:"size",options:t,async fn(e){var o,r;const{placement:s,rects:i,platform:n,elements:a}=e,{apply:l=()=>{},...d}=Dt(t,e),u=await n.detectOverflow(e,d),h=gt(s),b=It(s),f=st(s)==="y",{width:g,height:m}=i.floating;let y,v;h==="top"||h==="bottom"?(y=h,v=b===(await(n.isRTL==null?void 0:n.isRTL(a.floating))?"start":"end")?"left":"right"):(v=h,y=b==="end"?"top":"bottom");const w=m-u.top-u.bottom,x=g-u.left-u.right,A=bt(m-u[y],w),z=bt(g-u[v],x),k=!e.middlewareData.shift;let B=A,ot=z;if((o=e.middlewareData.shift)!=null&&o.enabled.x&&(ot=x),(r=e.middlewareData.shift)!=null&&r.enabled.y&&(B=w),k&&!b){const j=N(u.left,0),lt=N(u.right,0),Q=N(u.top,0),ct=N(u.bottom,0);f?ot=g-2*(j!==0||lt!==0?j+lt:N(u.left,u.right)):B=m-2*(Q!==0||ct!==0?Q+ct:N(u.top,u.bottom))}await l({...e,availableWidth:ot,availableHeight:B});const J=await n.getDimensions(a.floating);return g!==J.width||m!==J.height?{reset:{rects:!0}}:{}}}};function ye(){return typeof window<"u"}function Mt(t){return ir(t)?(t.nodeName||"").toLowerCase():"#document"}function H(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function et(t){var e;return(e=(ir(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function ir(t){return ye()?t instanceof Node||t instanceof H(t).Node:!1}function Y(t){return ye()?t instanceof Element||t instanceof H(t).Element:!1}function at(t){return ye()?t instanceof HTMLElement||t instanceof H(t).HTMLElement:!1}function Ao(t){return!ye()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof H(t).ShadowRoot}function te(t){const{overflow:e,overflowX:o,overflowY:r,display:s}=X(t);return/auto|scroll|overlay|hidden|clip/.test(e+r+o)&&s!=="inline"&&s!=="contents"}function qs(t){return/^(table|td|th)$/.test(Mt(t))}function we(t){try{if(t.matches(":popover-open"))return!0}catch{}try{return t.matches(":modal")}catch{return!1}}const Ks=/transform|translate|scale|rotate|perspective|filter/,Ys=/paint|layout|strict|content/,_t=t=>!!t&&t!=="none";let Le;function _e(t){const e=Y(t)?X(t):t;return _t(e.transform)||_t(e.translate)||_t(e.scale)||_t(e.rotate)||_t(e.perspective)||!Qe()&&(_t(e.backdropFilter)||_t(e.filter))||Ks.test(e.willChange||"")||Ys.test(e.contain||"")}function Xs(t){let e=mt(t);for(;at(e)&&!Rt(e);){if(_e(e))return e;if(we(e))return null;e=mt(e)}return null}function Qe(){return Le==null&&(Le=typeof CSS<"u"&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),Le}function Rt(t){return/^(html|body|#document)$/.test(Mt(t))}function X(t){return H(t).getComputedStyle(t)}function xe(t){return Y(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function mt(t){if(Mt(t)==="html")return t;const e=t.assignedSlot||t.parentNode||Ao(t)&&t.host||et(t);return Ao(e)?e.host:e}function nr(t){const e=mt(t);return Rt(e)?t.ownerDocument?t.ownerDocument.body:t.body:at(e)&&te(e)?e:nr(e)}function Zt(t,e,o){var r;e===void 0&&(e=[]),o===void 0&&(o=!0);const s=nr(t),i=s===((r=t.ownerDocument)==null?void 0:r.body),n=H(s);if(i){const a=Ue(n);return e.concat(n,n.visualViewport||[],te(s)?s:[],a&&o?Zt(a):[])}else return e.concat(s,Zt(s,[],o))}function Ue(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function ar(t){const e=X(t);let o=parseFloat(e.width)||0,r=parseFloat(e.height)||0;const s=at(t),i=s?t.offsetWidth:o,n=s?t.offsetHeight:r,a=he(o)!==i||he(r)!==n;return a&&(o=i,r=n),{width:o,height:r,$:a}}function to(t){return Y(t)?t:t.contextElement}function Lt(t){const e=to(t);if(!at(e))return tt(1);const o=e.getBoundingClientRect(),{width:r,height:s,$:i}=ar(e);let n=(i?he(o.width):o.width)/r,a=(i?he(o.height):o.height)/s;return(!n||!Number.isFinite(n))&&(n=1),(!a||!Number.isFinite(a))&&(a=1),{x:n,y:a}}const Gs=tt(0);function lr(t){const e=H(t);return!Qe()||!e.visualViewport?Gs:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function Zs(t,e,o){return e===void 0&&(e=!1),!o||e&&o!==H(t)?!1:e}function St(t,e,o,r){e===void 0&&(e=!1),o===void 0&&(o=!1);const s=t.getBoundingClientRect(),i=to(t);let n=tt(1);e&&(r?Y(r)&&(n=Lt(r)):n=Lt(t));const a=Zs(i,o,r)?lr(i):tt(0);let l=(s.left+a.x)/n.x,d=(s.top+a.y)/n.y,u=s.width/n.x,h=s.height/n.y;if(i){const b=H(i),f=r&&Y(r)?H(r):r;let g=b,m=Ue(g);for(;m&&r&&f!==g;){const y=Lt(m),v=m.getBoundingClientRect(),w=X(m),x=v.left+(m.clientLeft+parseFloat(w.paddingLeft))*y.x,A=v.top+(m.clientTop+parseFloat(w.paddingTop))*y.y;l*=y.x,d*=y.y,u*=y.x,h*=y.y,l+=x,d+=A,g=H(m),m=Ue(g)}}return fe({width:u,height:h,x:l,y:d})}function $e(t,e){const o=xe(t).scrollLeft;return e?e.left+o:St(et(t)).left+o}function cr(t,e){const o=t.getBoundingClientRect(),r=o.left+e.scrollLeft-$e(t,o),s=o.top+e.scrollTop;return{x:r,y:s}}function Js(t){let{elements:e,rect:o,offsetParent:r,strategy:s}=t;const i=s==="fixed",n=et(r),a=e?we(e.floating):!1;if(r===n||a&&i)return o;let l={scrollLeft:0,scrollTop:0},d=tt(1);const u=tt(0),h=at(r);if((h||!h&&!i)&&((Mt(r)!=="body"||te(n))&&(l=xe(r)),h)){const f=St(r);d=Lt(r),u.x=f.x+r.clientLeft,u.y=f.y+r.clientTop}const b=n&&!h&&!i?cr(n,l):tt(0);return{width:o.width*d.x,height:o.height*d.y,x:o.x*d.x-l.scrollLeft*d.x+u.x+b.x,y:o.y*d.y-l.scrollTop*d.y+u.y+b.y}}function Qs(t){return Array.from(t.getClientRects())}function ti(t){const e=et(t),o=xe(t),r=t.ownerDocument.body,s=N(e.scrollWidth,e.clientWidth,r.scrollWidth,r.clientWidth),i=N(e.scrollHeight,e.clientHeight,r.scrollHeight,r.clientHeight);let n=-o.scrollLeft+$e(t);const a=-o.scrollTop;return X(r).direction==="rtl"&&(n+=N(e.clientWidth,r.clientWidth)-s),{width:s,height:i,x:n,y:a}}const Co=25;function ei(t,e){const o=H(t),r=et(t),s=o.visualViewport;let i=r.clientWidth,n=r.clientHeight,a=0,l=0;if(s){i=s.width,n=s.height;const u=Qe();(!u||u&&e==="fixed")&&(a=s.offsetLeft,l=s.offsetTop)}const d=$e(r);if(d<=0){const u=r.ownerDocument,h=u.body,b=getComputedStyle(h),f=u.compatMode==="CSS1Compat"&&parseFloat(b.marginLeft)+parseFloat(b.marginRight)||0,g=Math.abs(r.clientWidth-h.clientWidth-f);g<=Co&&(i-=g)}else d<=Co&&(i+=d);return{width:i,height:n,x:a,y:l}}function oi(t,e){const o=St(t,!0,e==="fixed"),r=o.top+t.clientTop,s=o.left+t.clientLeft,i=at(t)?Lt(t):tt(1),n=t.clientWidth*i.x,a=t.clientHeight*i.y,l=s*i.x,d=r*i.y;return{width:n,height:a,x:l,y:d}}function ko(t,e,o){let r;if(e==="viewport")r=ei(t,o);else if(e==="document")r=ti(et(t));else if(Y(e))r=oi(e,o);else{const s=lr(t);r={x:e.x-s.x,y:e.y-s.y,width:e.width,height:e.height}}return fe(r)}function dr(t,e){const o=mt(t);return o===e||!Y(o)||Rt(o)?!1:X(o).position==="fixed"||dr(o,e)}function ri(t,e){const o=e.get(t);if(o)return o;let r=Zt(t,[],!1).filter(a=>Y(a)&&Mt(a)!=="body"),s=null;const i=X(t).position==="fixed";let n=i?mt(t):t;for(;Y(n)&&!Rt(n);){const a=X(n),l=_e(n);!l&&a.position==="fixed"&&(s=null),(i?!l&&!s:!l&&a.position==="static"&&!!s&&(s.position==="absolute"||s.position==="fixed")||te(n)&&!l&&dr(t,n))?r=r.filter(u=>u!==n):s=a,n=mt(n)}return e.set(t,r),r}function si(t){let{element:e,boundary:o,rootBoundary:r,strategy:s}=t;const n=[...o==="clippingAncestors"?we(e)?[]:ri(e,this._c):[].concat(o),r],a=ko(e,n[0],s);let l=a.top,d=a.right,u=a.bottom,h=a.left;for(let b=1;b<n.length;b++){const f=ko(e,n[b],s);l=N(f.top,l),d=bt(f.right,d),u=bt(f.bottom,u),h=N(f.left,h)}return{width:d-h,height:u-l,x:h,y:l}}function ii(t){const{width:e,height:o}=ar(t);return{width:e,height:o}}function ni(t,e,o){const r=at(e),s=et(e),i=o==="fixed",n=St(t,!0,i,e);let a={scrollLeft:0,scrollTop:0};const l=tt(0);function d(){l.x=$e(s)}if(r||!r&&!i)if((Mt(e)!=="body"||te(s))&&(a=xe(e)),r){const f=St(e,!0,i,e);l.x=f.x+e.clientLeft,l.y=f.y+e.clientTop}else s&&d();i&&!r&&s&&d();const u=s&&!r&&!i?cr(s,a):tt(0),h=n.left+a.scrollLeft-l.x-u.x,b=n.top+a.scrollTop-l.y-u.y;return{x:h,y:b,width:n.width,height:n.height}}function Re(t){return X(t).position==="static"}function Eo(t,e){if(!at(t)||X(t).position==="fixed")return null;if(e)return e(t);let o=t.offsetParent;return et(t)===o&&(o=o.ownerDocument.body),o}function ur(t,e){const o=H(t);if(we(t))return o;if(!at(t)){let s=mt(t);for(;s&&!Rt(s);){if(Y(s)&&!Re(s))return s;s=mt(s)}return o}let r=Eo(t,e);for(;r&&qs(r)&&Re(r);)r=Eo(r,e);return r&&Rt(r)&&Re(r)&&!_e(r)?o:r||Xs(t)||o}const ai=async function(t){const e=this.getOffsetParent||ur,o=this.getDimensions,r=await o(t.floating);return{reference:ni(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,width:r.width,height:r.height}}};function li(t){return X(t).direction==="rtl"}const le={convertOffsetParentRelativeRectToViewportRelativeRect:Js,getDocumentElement:et,getClippingRect:si,getOffsetParent:ur,getElementRects:ai,getClientRects:Qs,getDimensions:ii,getScale:Lt,isElement:Y,isRTL:li};function hr(t,e){return t.x===e.x&&t.y===e.y&&t.width===e.width&&t.height===e.height}function ci(t,e){let o=null,r;const s=et(t);function i(){var a;clearTimeout(r),(a=o)==null||a.disconnect(),o=null}function n(a,l){a===void 0&&(a=!1),l===void 0&&(l=1),i();const d=t.getBoundingClientRect(),{left:u,top:h,width:b,height:f}=d;if(a||e(),!b||!f)return;const g=se(h),m=se(s.clientWidth-(u+b)),y=se(s.clientHeight-(h+f)),v=se(u),x={rootMargin:-g+"px "+-m+"px "+-y+"px "+-v+"px",threshold:N(0,bt(1,l))||1};let A=!0;function z(k){const B=k[0].intersectionRatio;if(B!==l){if(!A)return n();B?n(!1,B):r=setTimeout(()=>{n(!1,1e-7)},1e3)}B===1&&!hr(d,t.getBoundingClientRect())&&n(),A=!1}try{o=new IntersectionObserver(z,{...x,root:s.ownerDocument})}catch{o=new IntersectionObserver(z,x)}o.observe(t)}return n(!0),i}function di(t,e,o,r){r===void 0&&(r={});const{ancestorScroll:s=!0,ancestorResize:i=!0,elementResize:n=typeof ResizeObserver=="function",layoutShift:a=typeof IntersectionObserver=="function",animationFrame:l=!1}=r,d=to(t),u=s||i?[...d?Zt(d):[],...e?Zt(e):[]]:[];u.forEach(v=>{s&&v.addEventListener("scroll",o,{passive:!0}),i&&v.addEventListener("resize",o)});const h=d&&a?ci(d,o):null;let b=-1,f=null;n&&(f=new ResizeObserver(v=>{let[w]=v;w&&w.target===d&&f&&e&&(f.unobserve(e),cancelAnimationFrame(b),b=requestAnimationFrame(()=>{var x;(x=f)==null||x.observe(e)})),o()}),d&&!l&&f.observe(d),e&&f.observe(e));let g,m=l?St(t):null;l&&y();function y(){const v=St(t);m&&!hr(m,v)&&o(),m=v,g=requestAnimationFrame(y)}return o(),()=>{var v;u.forEach(w=>{s&&w.removeEventListener("scroll",o),i&&w.removeEventListener("resize",o)}),h==null||h(),(v=f)==null||v.disconnect(),f=null,l&&cancelAnimationFrame(g)}}const ui=Us,hi=Ws,pi=Fs,So=js,fi=Ns,bi=(t,e,o)=>{const r=new Map,s={platform:le,...o},i={...s.platform,_c:r};return Ms(t,e,{...s,platform:i})};function gi(t){return mi(t)}function ze(t){return t.assignedSlot?t.assignedSlot:t.parentNode instanceof ShadowRoot?t.parentNode.host:t.parentNode}function mi(t){for(let e=t;e;e=ze(e))if(e instanceof Element&&getComputedStyle(e).display==="none")return null;for(let e=ze(t);e;e=ze(e)){if(!(e instanceof Element))continue;const o=getComputedStyle(e);if(o.display!=="contents"&&(o.position!=="static"||_e(o)||e.tagName==="BODY"))return e}return null}function vi(t){return t!==null&&typeof t=="object"&&"getBoundingClientRect"in t&&("contextElement"in t?t.contextElement instanceof Element:!0)}var $=class extends O{constructor(){super(...arguments),this.localize=new vt(this),this.active=!1,this.placement="top",this.strategy="absolute",this.distance=0,this.skidding=0,this.arrow=!1,this.arrowPlacement="anchor",this.arrowPadding=10,this.flip=!1,this.flipFallbackPlacements="",this.flipFallbackStrategy="best-fit",this.flipPadding=0,this.shift=!1,this.shiftPadding=0,this.autoSizePadding=0,this.hoverBridge=!1,this.updateHoverBridge=()=>{if(this.hoverBridge&&this.anchorEl){const t=this.anchorEl.getBoundingClientRect(),e=this.popup.getBoundingClientRect(),o=this.placement.includes("top")||this.placement.includes("bottom");let r=0,s=0,i=0,n=0,a=0,l=0,d=0,u=0;o?t.top<e.top?(r=t.left,s=t.bottom,i=t.right,n=t.bottom,a=e.left,l=e.top,d=e.right,u=e.top):(r=e.left,s=e.bottom,i=e.right,n=e.bottom,a=t.left,l=t.top,d=t.right,u=t.top):t.left<e.left?(r=t.right,s=t.top,i=e.left,n=e.top,a=t.right,l=t.bottom,d=e.left,u=e.bottom):(r=e.right,s=e.top,i=t.left,n=t.top,a=e.right,l=e.bottom,d=t.left,u=t.bottom),this.style.setProperty("--hover-bridge-top-left-x",`${r}px`),this.style.setProperty("--hover-bridge-top-left-y",`${s}px`),this.style.setProperty("--hover-bridge-top-right-x",`${i}px`),this.style.setProperty("--hover-bridge-top-right-y",`${n}px`),this.style.setProperty("--hover-bridge-bottom-left-x",`${a}px`),this.style.setProperty("--hover-bridge-bottom-left-y",`${l}px`),this.style.setProperty("--hover-bridge-bottom-right-x",`${d}px`),this.style.setProperty("--hover-bridge-bottom-right-y",`${u}px`)}}}async connectedCallback(){super.connectedCallback(),await this.updateComplete,this.start()}disconnectedCallback(){super.disconnectedCallback(),this.stop()}async updated(t){super.updated(t),t.has("active")&&(this.active?this.start():this.stop()),t.has("anchor")&&this.handleAnchorChange(),this.active&&(await this.updateComplete,this.reposition())}async handleAnchorChange(){if(await this.stop(),this.anchor&&typeof this.anchor=="string"){const t=this.getRootNode();this.anchorEl=t.getElementById(this.anchor)}else this.anchor instanceof Element||vi(this.anchor)?this.anchorEl=this.anchor:this.anchorEl=this.querySelector('[slot="anchor"]');this.anchorEl instanceof HTMLSlotElement&&(this.anchorEl=this.anchorEl.assignedElements({flatten:!0})[0]),this.anchorEl&&this.active&&this.start()}start(){!this.anchorEl||!this.active||(this.cleanup=di(this.anchorEl,this.popup,()=>{this.reposition()}))}async stop(){return new Promise(t=>{this.cleanup?(this.cleanup(),this.cleanup=void 0,this.removeAttribute("data-current-placement"),this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height"),requestAnimationFrame(()=>t())):t()})}reposition(){if(!this.active||!this.anchorEl)return;const t=[ui({mainAxis:this.distance,crossAxis:this.skidding})];this.sync?t.push(So({apply:({rects:o})=>{const r=this.sync==="width"||this.sync==="both",s=this.sync==="height"||this.sync==="both";this.popup.style.width=r?`${o.reference.width}px`:"",this.popup.style.height=s?`${o.reference.height}px`:""}})):(this.popup.style.width="",this.popup.style.height=""),this.flip&&t.push(pi({boundary:this.flipBoundary,fallbackPlacements:this.flipFallbackPlacements,fallbackStrategy:this.flipFallbackStrategy==="best-fit"?"bestFit":"initialPlacement",padding:this.flipPadding})),this.shift&&t.push(hi({boundary:this.shiftBoundary,padding:this.shiftPadding})),this.autoSize?t.push(So({boundary:this.autoSizeBoundary,padding:this.autoSizePadding,apply:({availableWidth:o,availableHeight:r})=>{this.autoSize==="vertical"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-height",`${r}px`):this.style.removeProperty("--auto-size-available-height"),this.autoSize==="horizontal"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-width",`${o}px`):this.style.removeProperty("--auto-size-available-width")}})):(this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height")),this.arrow&&t.push(fi({element:this.arrowEl,padding:this.arrowPadding}));const e=this.strategy==="absolute"?o=>le.getOffsetParent(o,gi):le.getOffsetParent;bi(this.anchorEl,this.popup,{placement:this.placement,middleware:t,strategy:this.strategy,platform:Jt(nt({},le),{getOffsetParent:e})}).then(({x:o,y:r,middlewareData:s,placement:i})=>{const n=this.localize.dir()==="rtl",a={top:"bottom",right:"left",bottom:"top",left:"right"}[i.split("-")[0]];if(this.setAttribute("data-current-placement",i),Object.assign(this.popup.style,{left:`${o}px`,top:`${r}px`}),this.arrow){const l=s.arrow.x,d=s.arrow.y;let u="",h="",b="",f="";if(this.arrowPlacement==="start"){const g=typeof l=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";u=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"",h=n?g:"",f=n?"":g}else if(this.arrowPlacement==="end"){const g=typeof l=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";h=n?"":g,f=n?g:"",b=typeof d=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:""}else this.arrowPlacement==="center"?(f=typeof l=="number"?"calc(50% - var(--arrow-size-diagonal))":"",u=typeof d=="number"?"calc(50% - var(--arrow-size-diagonal))":""):(f=typeof l=="number"?`${l}px`:"",u=typeof d=="number"?`${d}px`:"");Object.assign(this.arrowEl.style,{top:u,right:h,bottom:b,left:f,[a]:"calc(var(--arrow-size-diagonal) * -1)"})}}),requestAnimationFrame(()=>this.updateHoverBridge()),this.emit("sl-reposition")}render(){return T`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${F({"popup-hover-bridge":!0,"popup-hover-bridge--visible":this.hoverBridge&&this.active})}
      ></span>

      <div
        part="popup"
        class=${F({popup:!0,"popup--active":this.active,"popup--fixed":this.strategy==="fixed","popup--has-arrow":this.arrow})}
      >
        <slot></slot>
        ${this.arrow?T`<div part="arrow" class="popup__arrow" role="presentation"></div>`:""}
      </div>
    `}};$.styles=[V,Es];c([C(".popup")],$.prototype,"popup",2);c([C(".popup__arrow")],$.prototype,"arrowEl",2);c([p()],$.prototype,"anchor",2);c([p({type:Boolean,reflect:!0})],$.prototype,"active",2);c([p({reflect:!0})],$.prototype,"placement",2);c([p({reflect:!0})],$.prototype,"strategy",2);c([p({type:Number})],$.prototype,"distance",2);c([p({type:Number})],$.prototype,"skidding",2);c([p({type:Boolean})],$.prototype,"arrow",2);c([p({attribute:"arrow-placement"})],$.prototype,"arrowPlacement",2);c([p({attribute:"arrow-padding",type:Number})],$.prototype,"arrowPadding",2);c([p({type:Boolean})],$.prototype,"flip",2);c([p({attribute:"flip-fallback-placements",converter:{fromAttribute:t=>t.split(" ").map(e=>e.trim()).filter(e=>e!==""),toAttribute:t=>t.join(" ")}})],$.prototype,"flipFallbackPlacements",2);c([p({attribute:"flip-fallback-strategy"})],$.prototype,"flipFallbackStrategy",2);c([p({type:Object})],$.prototype,"flipBoundary",2);c([p({attribute:"flip-padding",type:Number})],$.prototype,"flipPadding",2);c([p({type:Boolean})],$.prototype,"shift",2);c([p({type:Object})],$.prototype,"shiftBoundary",2);c([p({attribute:"shift-padding",type:Number})],$.prototype,"shiftPadding",2);c([p({attribute:"auto-size"})],$.prototype,"autoSize",2);c([p()],$.prototype,"sync",2);c([p({type:Object})],$.prototype,"autoSizeBoundary",2);c([p({attribute:"auto-size-padding",type:Number})],$.prototype,"autoSizePadding",2);c([p({attribute:"hover-bridge",type:Boolean})],$.prototype,"hoverBridge",2);var pr=new Map,yi=new WeakMap;function wi(t){return t??{keyframes:[],options:{duration:0}}}function Po(t,e){return e.toLowerCase()==="rtl"?{keyframes:t.rtlKeyframes||t.keyframes,options:t.options}:t}function Nt(t,e){pr.set(t,wi(e))}function zt(t,e,o){const r=yi.get(t);if(r!=null&&r[e])return Po(r[e],o.dir);const s=pr.get(e);return s?Po(s,o.dir):{keyframes:[],options:{duration:0}}}function be(t,e){return new Promise(o=>{function r(s){s.target===t&&(t.removeEventListener(e,r),o())}t.addEventListener(e,r)})}function ge(t,e,o){return new Promise(r=>{if((o==null?void 0:o.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=t.animate(e,Jt(nt({},o),{duration:_i()?0:o.duration}));s.addEventListener("cancel",r,{once:!0}),s.addEventListener("finish",r,{once:!0})})}function To(t){return t=t.toString().toLowerCase(),t.indexOf("ms")>-1?parseFloat(t):t.indexOf("s")>-1?parseFloat(t)*1e3:parseFloat(t)}function _i(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function me(t){return Promise.all(t.getAnimations().map(e=>new Promise(o=>{e.cancel(),requestAnimationFrame(o)})))}function Oo(t,e){return t.map(o=>Jt(nt({},o),{height:o.height==="auto"?`${e}px`:o.height}))}var L=class extends O{constructor(){super(),this.localize=new vt(this),this.content="",this.placement="top",this.disabled=!1,this.distance=8,this.open=!1,this.skidding=0,this.trigger="hover focus",this.hoist=!1,this.handleBlur=()=>{this.hasTrigger("focus")&&this.hide()},this.handleClick=()=>{this.hasTrigger("click")&&(this.open?this.hide():this.show())},this.handleFocus=()=>{this.hasTrigger("focus")&&this.show()},this.handleDocumentKeyDown=t=>{t.key==="Escape"&&(t.stopPropagation(),this.hide())},this.handleMouseOver=()=>{if(this.hasTrigger("hover")){const t=To(getComputedStyle(this).getPropertyValue("--show-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.show(),t)}},this.handleMouseOut=()=>{if(this.hasTrigger("hover")){const t=To(getComputedStyle(this).getPropertyValue("--hide-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.hide(),t)}},this.addEventListener("blur",this.handleBlur,!0),this.addEventListener("focus",this.handleFocus,!0),this.addEventListener("click",this.handleClick),this.addEventListener("mouseover",this.handleMouseOver),this.addEventListener("mouseout",this.handleMouseOut)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this.closeWatcher)==null||t.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown)}firstUpdated(){this.body.hidden=!this.open,this.open&&(this.popup.active=!0,this.popup.reposition())}hasTrigger(t){return this.trigger.split(" ").includes(t)}async handleOpenChange(){var t,e;if(this.open){if(this.disabled)return;this.emit("sl-show"),"CloseWatcher"in window?((t=this.closeWatcher)==null||t.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.hide()}):document.addEventListener("keydown",this.handleDocumentKeyDown),await me(this.body),this.body.hidden=!1,this.popup.active=!0;const{keyframes:o,options:r}=zt(this,"tooltip.show",{dir:this.localize.dir()});await ge(this.popup.popup,o,r),this.popup.reposition(),this.emit("sl-after-show")}else{this.emit("sl-hide"),(e=this.closeWatcher)==null||e.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown),await me(this.body);const{keyframes:o,options:r}=zt(this,"tooltip.hide",{dir:this.localize.dir()});await ge(this.popup.popup,o,r),this.popup.active=!1,this.body.hidden=!0,this.emit("sl-after-hide")}}async handleOptionsChange(){this.hasUpdated&&(await this.updateComplete,this.popup.reposition())}handleDisabledChange(){this.disabled&&this.open&&this.hide()}async show(){if(!this.open)return this.open=!0,be(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,be(this,"sl-after-hide")}render(){return T`
      <sl-popup
        part="base"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${F({tooltip:!0,"tooltip--open":this.open})}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist?"fixed":"absolute"}
        flip
        shift
        arrow
        hover-bridge
      >
        ${""}
        <slot slot="anchor" aria-describedby="tooltip"></slot>

        ${""}
        <div part="body" id="tooltip" class="tooltip__body" role="tooltip" aria-live=${this.open?"polite":"off"}>
          <slot name="content">${this.content}</slot>
        </div>
      </sl-popup>
    `}};L.styles=[V,ks];L.dependencies={"sl-popup":$};c([C("slot:not([name])")],L.prototype,"defaultSlot",2);c([C(".tooltip__body")],L.prototype,"body",2);c([C("sl-popup")],L.prototype,"popup",2);c([p()],L.prototype,"content",2);c([p()],L.prototype,"placement",2);c([p({type:Boolean,reflect:!0})],L.prototype,"disabled",2);c([p({type:Number})],L.prototype,"distance",2);c([p({type:Boolean,reflect:!0})],L.prototype,"open",2);c([p({type:Number})],L.prototype,"skidding",2);c([p()],L.prototype,"trigger",2);c([p({type:Boolean})],L.prototype,"hoist",2);c([U("open",{waitUntilFirstUpdate:!0})],L.prototype,"handleOpenChange",1);c([U(["content","distance","hoist","placement","skidding"])],L.prototype,"handleOptionsChange",1);c([U("disabled")],L.prototype,"handleDisabledChange",1);Nt("tooltip.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:150,easing:"ease"}});Nt("tooltip.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:150,easing:"ease"}});var xi=M`
  :host {
    --error-color: var(--sl-color-danger-600);
    --success-color: var(--sl-color-success-600);

    display: inline-block;
  }

  .copy-button__button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
  }

  .copy-button--success .copy-button__button {
    color: var(--success-color);
  }

  .copy-button--error .copy-button__button {
    color: var(--error-color);
  }

  .copy-button__button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .copy-button__button[disabled] {
    opacity: 0.5;
    cursor: not-allowed !important;
  }

  slot {
    display: inline-flex;
  }
`,P=class extends O{constructor(){super(...arguments),this.localize=new vt(this),this.isCopying=!1,this.status="rest",this.value="",this.from="",this.disabled=!1,this.copyLabel="",this.successLabel="",this.errorLabel="",this.feedbackDuration=1e3,this.tooltipPlacement="top",this.hoist=!1}async handleCopy(){if(this.disabled||this.isCopying)return;this.isCopying=!0;let t=this.value;if(this.from){const e=this.getRootNode(),o=this.from.includes("."),r=this.from.includes("[")&&this.from.includes("]");let s=this.from,i="";o?[s,i]=this.from.trim().split("."):r&&([s,i]=this.from.trim().replace(/\]$/,"").split("["));const n="getElementById"in e?e.getElementById(s):null;n?r?t=n.getAttribute(i)||"":o?t=n[i]||"":t=n.textContent||"":(this.showStatus("error"),this.emit("sl-error"))}if(!t)this.showStatus("error"),this.emit("sl-error");else try{await navigator.clipboard.writeText(t),this.showStatus("success"),this.emit("sl-copy",{detail:{value:t}})}catch{this.showStatus("error"),this.emit("sl-error")}}async showStatus(t){const e=this.copyLabel||this.localize.term("copy"),o=this.successLabel||this.localize.term("copied"),r=this.errorLabel||this.localize.term("error"),s=t==="success"?this.successIcon:this.errorIcon,i=zt(this,"copy.in",{dir:"ltr"}),n=zt(this,"copy.out",{dir:"ltr"});this.tooltip.content=t==="success"?o:r,await this.copyIcon.animate(n.keyframes,n.options).finished,this.copyIcon.hidden=!0,this.status=t,s.hidden=!1,await s.animate(i.keyframes,i.options).finished,setTimeout(async()=>{await s.animate(n.keyframes,n.options).finished,s.hidden=!0,this.status="rest",this.copyIcon.hidden=!1,await this.copyIcon.animate(i.keyframes,i.options).finished,this.tooltip.content=e,this.isCopying=!1},this.feedbackDuration)}render(){const t=this.copyLabel||this.localize.term("copy");return T`
      <sl-tooltip
        class=${F({"copy-button":!0,"copy-button--success":this.status==="success","copy-button--error":this.status==="error"})}
        content=${t}
        placement=${this.tooltipPlacement}
        ?disabled=${this.disabled}
        ?hoist=${this.hoist}
        exportparts="
          base:tooltip__base,
          base__popup:tooltip__base__popup,
          base__arrow:tooltip__base__arrow,
          body:tooltip__body
        "
      >
        <button
          class="copy-button__button"
          part="button"
          type="button"
          ?disabled=${this.disabled}
          @click=${this.handleCopy}
        >
          <slot part="copy-icon" name="copy-icon">
            <sl-icon library="system" name="copy"></sl-icon>
          </slot>
          <slot part="success-icon" name="success-icon" hidden>
            <sl-icon library="system" name="check"></sl-icon>
          </slot>
          <slot part="error-icon" name="error-icon" hidden>
            <sl-icon library="system" name="x-lg"></sl-icon>
          </slot>
        </button>
      </sl-tooltip>
    `}};P.styles=[V,xi];P.dependencies={"sl-icon":W,"sl-tooltip":L};c([C('slot[name="copy-icon"]')],P.prototype,"copyIcon",2);c([C('slot[name="success-icon"]')],P.prototype,"successIcon",2);c([C('slot[name="error-icon"]')],P.prototype,"errorIcon",2);c([C("sl-tooltip")],P.prototype,"tooltip",2);c([it()],P.prototype,"isCopying",2);c([it()],P.prototype,"status",2);c([p()],P.prototype,"value",2);c([p()],P.prototype,"from",2);c([p({type:Boolean,reflect:!0})],P.prototype,"disabled",2);c([p({attribute:"copy-label"})],P.prototype,"copyLabel",2);c([p({attribute:"success-label"})],P.prototype,"successLabel",2);c([p({attribute:"error-label"})],P.prototype,"errorLabel",2);c([p({attribute:"feedback-duration",type:Number})],P.prototype,"feedbackDuration",2);c([p({attribute:"tooltip-placement"})],P.prototype,"tooltipPlacement",2);c([p({type:Boolean})],P.prototype,"hoist",2);Nt("copy.in",{keyframes:[{scale:".25",opacity:".25"},{scale:"1",opacity:"1"}],options:{duration:100}});Nt("copy.out",{keyframes:[{scale:"1",opacity:"1"},{scale:".25",opacity:"0"}],options:{duration:100}});P.define("sl-copy-button");var $i=M`
  :host {
    display: block;
  }

  .details {
    border: solid 1px var(--sl-color-neutral-200);
    border-radius: var(--sl-border-radius-medium);
    background-color: var(--sl-color-neutral-0);
    overflow-anchor: none;
  }

  .details--disabled {
    opacity: 0.5;
  }

  .details__header {
    display: flex;
    align-items: center;
    border-radius: inherit;
    padding: var(--sl-spacing-medium);
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }

  .details__header::-webkit-details-marker {
    display: none;
  }

  .details__header:focus {
    outline: none;
  }

  .details__header:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: calc(1px + var(--sl-focus-ring-offset));
  }

  .details--disabled .details__header {
    cursor: not-allowed;
  }

  .details--disabled .details__header:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .details__summary {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
  }

  .details__summary-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    transition: var(--sl-transition-medium) rotate ease;
  }

  .details--open .details__summary-icon {
    rotate: 90deg;
  }

  .details--open.details--rtl .details__summary-icon {
    rotate: -90deg;
  }

  .details--open slot[name='expand-icon'],
  .details:not(.details--open) slot[name='collapse-icon'] {
    display: none;
  }

  .details__body {
    overflow: hidden;
  }

  .details__content {
    display: block;
    padding: var(--sl-spacing-medium);
  }
`,G=class extends O{constructor(){super(...arguments),this.localize=new vt(this),this.open=!1,this.disabled=!1}firstUpdated(){this.body.style.height=this.open?"auto":"0",this.open&&(this.details.open=!0),this.detailsObserver=new MutationObserver(t=>{for(const e of t)e.type==="attributes"&&e.attributeName==="open"&&(this.details.open?this.show():this.hide())}),this.detailsObserver.observe(this.details,{attributes:!0})}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this.detailsObserver)==null||t.disconnect()}handleSummaryClick(t){t.preventDefault(),this.disabled||(this.open?this.hide():this.show(),this.header.focus())}handleSummaryKeyDown(t){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.open?this.hide():this.show()),(t.key==="ArrowUp"||t.key==="ArrowLeft")&&(t.preventDefault(),this.hide()),(t.key==="ArrowDown"||t.key==="ArrowRight")&&(t.preventDefault(),this.show())}async handleOpenChange(){if(this.open){if(this.details.open=!0,this.emit("sl-show",{cancelable:!0}).defaultPrevented){this.open=!1,this.details.open=!1;return}await me(this.body);const{keyframes:e,options:o}=zt(this,"details.show",{dir:this.localize.dir()});await ge(this.body,Oo(e,this.body.scrollHeight),o),this.body.style.height="auto",this.emit("sl-after-show")}else{if(this.emit("sl-hide",{cancelable:!0}).defaultPrevented){this.details.open=!0,this.open=!0;return}await me(this.body);const{keyframes:e,options:o}=zt(this,"details.hide",{dir:this.localize.dir()});await ge(this.body,Oo(e,this.body.scrollHeight),o),this.body.style.height="auto",this.details.open=!1,this.emit("sl-after-hide")}}async show(){if(!(this.open||this.disabled))return this.open=!0,be(this,"sl-after-show")}async hide(){if(!(!this.open||this.disabled))return this.open=!1,be(this,"sl-after-hide")}render(){const t=this.localize.dir()==="rtl";return T`
      <details
        part="base"
        class=${F({details:!0,"details--open":this.open,"details--disabled":this.disabled,"details--rtl":t})}
      >
        <summary
          part="header"
          id="header"
          class="details__header"
          role="button"
          aria-expanded=${this.open?"true":"false"}
          aria-controls="content"
          aria-disabled=${this.disabled?"true":"false"}
          tabindex=${this.disabled?"-1":"0"}
          @click=${this.handleSummaryClick}
          @keydown=${this.handleSummaryKeyDown}
        >
          <slot name="summary" part="summary" class="details__summary">${this.summary}</slot>

          <span part="summary-icon" class="details__summary-icon">
            <slot name="expand-icon">
              <sl-icon library="system" name=${t?"chevron-left":"chevron-right"}></sl-icon>
            </slot>
            <slot name="collapse-icon">
              <sl-icon library="system" name=${t?"chevron-left":"chevron-right"}></sl-icon>
            </slot>
          </span>
        </summary>

        <div class="details__body" role="region" aria-labelledby="header">
          <slot part="content" id="content" class="details__content"></slot>
        </div>
      </details>
    `}};G.styles=[V,$i];G.dependencies={"sl-icon":W};c([C(".details")],G.prototype,"details",2);c([C(".details__header")],G.prototype,"header",2);c([C(".details__body")],G.prototype,"body",2);c([C(".details__expand-icon-slot")],G.prototype,"expandIconSlot",2);c([p({type:Boolean,reflect:!0})],G.prototype,"open",2);c([p()],G.prototype,"summary",2);c([p({type:Boolean,reflect:!0})],G.prototype,"disabled",2);c([U("open",{waitUntilFirstUpdate:!0})],G.prototype,"handleOpenChange",1);Nt("details.show",{keyframes:[{height:"0",opacity:"0"},{height:"auto",opacity:"1"}],options:{duration:250,easing:"linear"}});Nt("details.hide",{keyframes:[{height:"auto",opacity:"1"},{height:"0",opacity:"0"}],options:{duration:250,easing:"linear"}});G.define("sl-details");var Ai=M`
  :host {
    --indicator-color: var(--sl-color-primary-600);
    --track-color: var(--sl-color-neutral-200);
    --track-width: 2px;

    display: block;
  }

  .tab-group {
    display: flex;
    border-radius: 0;
  }

  .tab-group__tabs {
    display: flex;
    position: relative;
  }

  .tab-group__indicator {
    position: absolute;
    transition:
      var(--sl-transition-fast) translate ease,
      var(--sl-transition-fast) width ease;
  }

  .tab-group--has-scroll-controls .tab-group__nav-container {
    position: relative;
    padding: 0 var(--sl-spacing-x-large);
  }

  .tab-group--has-scroll-controls .tab-group__scroll-button--start--hidden,
  .tab-group--has-scroll-controls .tab-group__scroll-button--end--hidden {
    visibility: hidden;
  }

  .tab-group__body {
    display: block;
    overflow: auto;
  }

  .tab-group__scroll-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--sl-spacing-x-large);
  }

  .tab-group__scroll-button--start {
    left: 0;
  }

  .tab-group__scroll-button--end {
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--start {
    left: auto;
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--end {
    left: 0;
    right: auto;
  }

  /*
   * Top
   */

  .tab-group--top {
    flex-direction: column;
  }

  .tab-group--top .tab-group__nav-container {
    order: 1;
  }

  .tab-group--top .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--top .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--top .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-bottom: solid var(--track-width) var(--track-color);
  }

  .tab-group--top .tab-group__indicator {
    bottom: calc(-1 * var(--track-width));
    border-bottom: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--top .tab-group__body {
    order: 2;
  }

  .tab-group--top ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Bottom
   */

  .tab-group--bottom {
    flex-direction: column;
  }

  .tab-group--bottom .tab-group__nav-container {
    order: 2;
  }

  .tab-group--bottom .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--bottom .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--bottom .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-top: solid var(--track-width) var(--track-color);
  }

  .tab-group--bottom .tab-group__indicator {
    top: calc(-1 * var(--track-width));
    border-top: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--bottom .tab-group__body {
    order: 1;
  }

  .tab-group--bottom ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Start
   */

  .tab-group--start {
    flex-direction: row;
  }

  .tab-group--start .tab-group__nav-container {
    order: 1;
  }

  .tab-group--start .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-inline-end: solid var(--track-width) var(--track-color);
  }

  .tab-group--start .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    border-right: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--start.tab-group--rtl .tab-group__indicator {
    right: auto;
    left: calc(-1 * var(--track-width));
  }

  .tab-group--start .tab-group__body {
    flex: 1 1 auto;
    order: 2;
  }

  .tab-group--start ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }

  /*
   * End
   */

  .tab-group--end {
    flex-direction: row;
  }

  .tab-group--end .tab-group__nav-container {
    order: 2;
  }

  .tab-group--end .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-left: solid var(--track-width) var(--track-color);
  }

  .tab-group--end .tab-group__indicator {
    left: calc(-1 * var(--track-width));
    border-inline-start: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--end.tab-group--rtl .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    left: auto;
  }

  .tab-group--end .tab-group__body {
    flex: 1 1 auto;
    order: 1;
  }

  .tab-group--end ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }
`,Ci=M`
  :host {
    display: contents;
  }
`,Ae=class extends O{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(t=>{this.emit("sl-resize",{detail:{entries:t}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const t=this.shadowRoot.querySelector("slot");if(t!==null){const e=t.assignedElements({flatten:!0});this.observedElements.forEach(o=>this.resizeObserver.unobserve(o)),this.observedElements=[],e.forEach(o=>{this.resizeObserver.observe(o),this.observedElements.push(o)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return T` <slot @slotchange=${this.handleSlotChange}></slot> `}};Ae.styles=[V,Ci];c([p({type:Boolean,reflect:!0})],Ae.prototype,"disabled",2);c([U("disabled",{waitUntilFirstUpdate:!0})],Ae.prototype,"handleDisabledChange",1);function ki(t,e){return{top:Math.round(t.getBoundingClientRect().top-e.getBoundingClientRect().top),left:Math.round(t.getBoundingClientRect().left-e.getBoundingClientRect().left)}}function Lo(t,e,o="vertical",r="smooth"){const s=ki(t,e),i=s.top+e.scrollTop,n=s.left+e.scrollLeft,a=e.scrollLeft,l=e.scrollLeft+e.offsetWidth,d=e.scrollTop,u=e.scrollTop+e.offsetHeight;(o==="horizontal"||o==="both")&&(n<a?e.scrollTo({left:n,behavior:r}):n+t.clientWidth>l&&e.scrollTo({left:n-e.offsetWidth+t.clientWidth,behavior:r})),(o==="vertical"||o==="both")&&(i<d?e.scrollTo({top:i,behavior:r}):i+t.clientHeight>u&&e.scrollTo({top:i-e.offsetHeight+t.clientHeight,behavior:r}))}var Ei=M`
  :host {
    display: inline-block;
    color: var(--sl-color-neutral-600);
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus-visible:not(.icon-button--disabled) {
    color: var(--sl-color-primary-600);
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: var(--sl-color-primary-700);
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .icon-button__icon {
    pointer-events: none;
  }
`,I=class extends O{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(t){this.disabled&&(t.preventDefault(),t.stopPropagation())}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}render(){const t=!!this.href,e=t?ue`a`:ue`button`;return ae`
      <${e}
        part="base"
        class=${F({"icon-button":!0,"icon-button--disabled":!t&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${E(t?void 0:this.disabled)}
        type=${E(t?void 0:"button")}
        href=${E(t?this.href:void 0)}
        target=${E(t?this.target:void 0)}
        download=${E(t?this.download:void 0)}
        rel=${E(t&&this.target?"noreferrer noopener":void 0)}
        role=${E(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${E(this.name)}
          library=${E(this.library)}
          src=${E(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${e}>
    `}};I.styles=[V,Ei];I.dependencies={"sl-icon":W};c([C(".icon-button")],I.prototype,"button",2);c([it()],I.prototype,"hasFocus",2);c([p()],I.prototype,"name",2);c([p()],I.prototype,"library",2);c([p()],I.prototype,"src",2);c([p()],I.prototype,"href",2);c([p()],I.prototype,"target",2);c([p()],I.prototype,"download",2);c([p()],I.prototype,"label",2);c([p({type:Boolean,reflect:!0})],I.prototype,"disabled",2);var R=class extends O{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new vt(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const t=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(e=>{const o=e.filter(({target:r})=>{if(r===this)return!0;if(r.closest("sl-tab-group")!==this)return!1;const s=r.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(o.length!==0){if(o.some(r=>!["aria-labelledby","aria-controls"].includes(r.attributeName))&&setTimeout(()=>this.setAriaLabels()),o.some(r=>r.attributeName==="disabled"))this.syncTabsAndPanels();else if(o.some(r=>r.attributeName==="active")){const s=o.filter(i=>i.attributeName==="active"&&i.target.tagName.toLowerCase()==="sl-tab").map(i=>i.target).find(i=>i.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),t.then(()=>{new IntersectionObserver((o,r)=>{var s;o[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),r.unobserve(o[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var t,e;super.disconnectedCallback(),(t=this.mutationObserver)==null||t.disconnect(),this.nav&&((e=this.resizeObserver)==null||e.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(t=>t.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(t=>t.active)}handleClick(t){const o=t.target.closest("sl-tab");(o==null?void 0:o.closest("sl-tab-group"))===this&&o!==null&&this.setActiveTab(o,{scrollBehavior:"smooth"})}handleKeyDown(t){const o=t.target.closest("sl-tab");if((o==null?void 0:o.closest("sl-tab-group"))===this&&(["Enter"," "].includes(t.key)&&o!==null&&(this.setActiveTab(o,{scrollBehavior:"smooth"}),t.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key))){const s=this.tabs.find(a=>a.matches(":focus")),i=this.localize.dir()==="rtl";let n=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(t.key==="Home")n=this.focusableTabs[0];else if(t.key==="End")n=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&t.key===(i?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&t.key==="ArrowUp"){const a=this.tabs.findIndex(l=>l===s);n=this.findNextFocusableTab(a,"backward")}else if(["top","bottom"].includes(this.placement)&&t.key===(i?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&t.key==="ArrowDown"){const a=this.tabs.findIndex(l=>l===s);n=this.findNextFocusableTab(a,"forward")}if(!n)return;n.tabIndex=0,n.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(n,{scrollBehavior:"smooth"}):this.tabs.forEach(a=>{a.tabIndex=a===n?0:-1}),["top","bottom"].includes(this.placement)&&Lo(n,this.nav,"horizontal"),t.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(t,e){if(e=nt({emitEvents:!0,scrollBehavior:"auto"},e),t!==this.activeTab&&!t.disabled){const o=this.activeTab;this.activeTab=t,this.tabs.forEach(r=>{r.active=r===this.activeTab,r.tabIndex=r===this.activeTab?0:-1}),this.panels.forEach(r=>{var s;return r.active=r.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&Lo(this.activeTab,this.nav,"horizontal",e.scrollBehavior),e.emitEvents&&(o&&this.emit("sl-tab-hide",{detail:{name:o.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(t=>{const e=this.panels.find(o=>o.name===t.panel);e&&(t.setAttribute("aria-controls",e.getAttribute("id")),e.setAttribute("aria-labelledby",t.getAttribute("id")))})}repositionIndicator(){const t=this.getActiveTab();if(!t)return;const e=t.clientWidth,o=t.clientHeight,r=this.localize.dir()==="rtl",s=this.getAllTabs(),n=s.slice(0,s.indexOf(t)).reduce((a,l)=>({left:a.left+l.clientWidth,top:a.top+l.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${e}px`,this.indicator.style.height="auto",this.indicator.style.translate=r?`${-1*n.left}px`:`${n.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${o}px`,this.indicator.style.translate=`0 ${n.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(t=>!t.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(t,e){let o=null;const r=e==="forward"?1:-1;let s=t+r;for(;t<this.tabs.length;){if(o=this.tabs[s]||null,o===null){e==="forward"?o=this.focusableTabs[0]:o=this.focusableTabs[this.focusableTabs.length-1];break}if(!o.disabled)break;s+=r}return o}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(t){const e=this.tabs.find(o=>o.panel===t);e&&this.setActiveTab(e,{scrollBehavior:"smooth"})}render(){const t=this.localize.dir()==="rtl";return T`
      <div
        part="base"
        class=${F({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${F({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
                  name=${t?"chevron-right":"chevron-left"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToStart")}
                  @click=${this.handleScrollToStart}
                ></sl-icon-button>
              `:""}

          <div class="tab-group__nav" @scrollend=${this.updateScrollButtons}>
            <div part="tabs" class="tab-group__tabs" role="tablist">
              <div part="active-tab-indicator" class="tab-group__indicator"></div>
              <sl-resize-observer @sl-resize=${this.syncIndicator}>
                <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
              </sl-resize-observer>
            </div>
          </div>

          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${F({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
                  name=${t?"chevron-left":"chevron-right"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToEnd")}
                  @click=${this.handleScrollToEnd}
                ></sl-icon-button>
              `:""}
        </div>

        <slot part="body" class="tab-group__body" @slotchange=${this.syncTabsAndPanels}></slot>
      </div>
    `}};R.styles=[V,Ai];R.dependencies={"sl-icon-button":I,"sl-resize-observer":Ae};c([C(".tab-group")],R.prototype,"tabGroup",2);c([C(".tab-group__body")],R.prototype,"body",2);c([C(".tab-group__nav")],R.prototype,"nav",2);c([C(".tab-group__indicator")],R.prototype,"indicator",2);c([it()],R.prototype,"hasScrollControls",2);c([it()],R.prototype,"shouldHideScrollStartButton",2);c([it()],R.prototype,"shouldHideScrollEndButton",2);c([p()],R.prototype,"placement",2);c([p()],R.prototype,"activation",2);c([p({attribute:"no-scroll-controls",type:Boolean})],R.prototype,"noScrollControls",2);c([p({attribute:"fixed-scroll-controls",type:Boolean})],R.prototype,"fixedScrollControls",2);c([Yr({passive:!0})],R.prototype,"updateScrollButtons",1);c([U("noScrollControls",{waitUntilFirstUpdate:!0})],R.prototype,"updateScrollControls",1);c([U("placement",{waitUntilFirstUpdate:!0})],R.prototype,"syncIndicator",1);R.define("sl-tab-group");var Si=(t,e)=>{let o=0;return function(...r){window.clearTimeout(o),o=window.setTimeout(()=>{t.call(this,...r)},e)}},Ro=(t,e,o)=>{const r=t[e];t[e]=function(...s){r.call(this,...s),o.call(this,r,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const e=new Set,o=new WeakMap,r=i=>{for(const n of i.changedTouches)e.add(n.identifier)},s=i=>{for(const n of i.changedTouches)e.delete(n.identifier)};document.addEventListener("touchstart",r,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),Ro(EventTarget.prototype,"addEventListener",function(i,n){if(n!=="scrollend")return;const a=Si(()=>{e.size?a():this.dispatchEvent(new Event("scrollend"))},100);i.call(this,"scroll",a,{passive:!0}),o.set(this,a)}),Ro(EventTarget.prototype,"removeEventListener",function(i,n){if(n!=="scrollend")return;const a=o.get(this);a&&i.call(this,"scroll",a,{passive:!0})})}})();var Pi=M`
  :host {
    display: inline-block;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    border-radius: var(--sl-border-radius-medium);
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-medium) var(--sl-spacing-large);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition:
      var(--transition-speed) box-shadow,
      var(--transition-speed) color;
  }

  .tab:hover:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  :host(:focus) {
    outline: transparent;
  }

  :host(:focus-visible) {
    color: var(--sl-color-primary-600);
    outline: var(--sl-focus-ring);
    outline-offset: calc(-1 * var(--sl-focus-ring-width) - var(--sl-focus-ring-offset));
  }

  .tab.tab--active:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab.tab--closable {
    padding-inline-end: var(--sl-spacing-small);
  }

  .tab.tab--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab__close-button {
    font-size: var(--sl-font-size-small);
    margin-inline-start: var(--sl-spacing-small);
  }

  .tab__close-button::part(base) {
    padding: var(--sl-spacing-3x-small);
  }

  @media (forced-colors: active) {
    .tab.tab--active:not(.tab--disabled) {
      outline: solid 1px transparent;
      outline-offset: -3px;
    }
  }
`,Ti=0,Z=class extends O{constructor(){super(...arguments),this.localize=new vt(this),this.attrId=++Ti,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(t){t.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,T`
      <div
        part="base"
        class=${F({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?T`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                class="tab__close-button"
                @click=${this.handleCloseClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </div>
    `}};Z.styles=[V,Pi];Z.dependencies={"sl-icon-button":I};c([C(".tab")],Z.prototype,"tab",2);c([p({reflect:!0})],Z.prototype,"panel",2);c([p({type:Boolean,reflect:!0})],Z.prototype,"active",2);c([p({type:Boolean,reflect:!0})],Z.prototype,"closable",2);c([p({type:Boolean,reflect:!0})],Z.prototype,"disabled",2);c([p({type:Number,reflect:!0})],Z.prototype,"tabIndex",2);c([U("active")],Z.prototype,"handleActiveChange",1);c([U("disabled")],Z.prototype,"handleDisabledChange",1);Z.define("sl-tab");var Oi=M`
  :host {
    --padding: 0;

    display: none;
  }

  :host([active]) {
    display: block;
  }

  .tab-panel {
    display: block;
    padding: var(--padding);
  }
`,Li=0,ee=class extends O{constructor(){super(...arguments),this.attrId=++Li,this.componentId=`sl-tab-panel-${this.attrId}`,this.name="",this.active=!1}connectedCallback(){super.connectedCallback(),this.id=this.id.length>0?this.id:this.componentId,this.setAttribute("role","tabpanel")}handleActiveChange(){this.setAttribute("aria-hidden",this.active?"false":"true")}render(){return T`
      <slot
        part="base"
        class=${F({"tab-panel":!0,"tab-panel--active":this.active})}
      ></slot>
    `}};ee.styles=[V,Oi];c([p({reflect:!0})],ee.prototype,"name",2);c([p({type:Boolean,reflect:!0})],ee.prototype,"active",2);c([U("active")],ee.prototype,"handleActiveChange",1);ee.define("sl-tab-panel");I.define("sl-icon-button");const Ri=[{path:"/",action:async()=>{await ut(()=>import("./assets/index-CNUHFB0B.js"),__vite__mapDeps([0,1,2]))},component:"page-home"},{path:"/blog",action:async()=>{await ut(()=>import("./assets/index-BDLogV3J.js"),__vite__mapDeps([3,1,4]))},component:"page-blog"},{path:"/sitemap.xml",action:async()=>{await ut(()=>import("./assets/sitemap.xml-BUnEn-7s.js"),__vite__mapDeps([5,6]))},component:"page-sitemap-xml"},{path:"/blog/:slug",action:async()=>{await ut(()=>import("./assets/_slug_-mN6PdFqV.js"),__vite__mapDeps([7,8,6,1,4]))},component:"page-blog-slug"},{path:"/blog/tags/:tag",action:async()=>{await ut(()=>import("./assets/_tag_-BPPrkBPK.js"),__vite__mapDeps([9,1,4]))},component:"page-blog-tags-tag"},{path:"/docs/:slug(.*)*",action:async()=>{await ut(()=>import("./assets/_...slug_-kV-pnBST.js"),__vite__mapDeps([10,8,6,1,2]))},component:"page-docs-slug"}];Ne("/shoelace/");document.addEventListener("DOMContentLoaded",()=>{const t=document.querySelector("litro-outlet");t?t.routes=Ri:console.warn("[litro] <litro-outlet> not found — router will not start.")});export{S as A,ft as E,Ct as a,T as b,$r as c,Pt as d,xr as e,M as i,it as r,Ko as t};
