(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function t(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(s){if(s.ep)return;s.ep=!0;const a=t(s);fetch(s.href,a)}})();const Y="modulepreload",V=function(e){return"/"+e},D={},J=function(n,t,r){let s=Promise.resolve();if(t&&t.length>0){let i=function(l){return Promise.all(l.map(u=>Promise.resolve(u).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),d=o?.nonce||o?.getAttribute("nonce");s=i(t.map(l=>{if(l=V(l),l in D)return;D[l]=!0;const u=l.endsWith(".css"),m=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${m}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":Y,u||(p.as="script"),p.crossOrigin="",p.href=l,d&&p.setAttribute("nonce",d),document.head.appendChild(p),u)return new Promise((G,x)=>{p.addEventListener("load",G),p.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${l}`)))})}))}function a(i){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=i,window.dispatchEvent(o),!o.defaultPrevented)throw i}return s.then(i=>{for(const o of i||[])o.status==="rejected"&&a(o.reason);return n().catch(a)})},f=256*1024,Q=1024*1024*1024,M=8,ee=`
  postMessage("ready");
  onmessage = async (event) => {
    const { url, handle, start, end, sab } = event.data;
    const state = new Int32Array(sab, 0, 2);
    const data = new Uint8Array(sab, 8);
    try {
      let bytes;
      if (handle) {
        const file = await handle.getFile();
        bytes = new Uint8Array(await file.slice(start, end + 1).arrayBuffer());
      } else {
        const response = await fetch(url, { headers: { Range: "bytes=" + start + "-" + end } });
        if (!response.ok && response.status !== 206) throw new Error("HTTP " + response.status);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      data.set(bytes.subarray(0, data.length));
      state[1] = Math.min(bytes.length, data.length);
      Atomics.store(state, 0, 1);
    } catch {
      state[1] = 0;
      Atomics.store(state, 0, 2);
    }
  };`;class te{constructor(n){if(this.onError=n,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([ee],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(f*M+8),this.ready=new Promise(t=>this.worker?.addEventListener("message",t,{once:!0}))}cache=new Map;cached=0;nextIndex=new Map;worker=null;buffer=null;ready;fetchChunkSync(n,t,r,s=1){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const a=new Int32Array(this.buffer,0,2);Atomics.store(a,0,0);const i=t*f;this.worker.postMessage({url:r?"":new URL(n,location.href).href,handle:r,start:i,end:i+f*s-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(a,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${n} chunk ${t}`),new Uint8Array(0);return Atomics.load(a,0)!==1?(this.onError(`Archive fetch failed: ${n} chunk ${t}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(a[1]??0)))}takeChunk(n,t,r){const s=`${n}#${t}`,a=this.cache.get(s);if(a)return this.cache.delete(s),this.cache.set(s,a),a;const i=this.nextIndex.get(n)===t,o=this.fetchChunkSync(n,t,r,i?M:1);this.nextIndex.set(n,t+o.length/f);for(let l=0;l<o.length;l+=f){const u=o.subarray(l,Math.min(l+f,o.length)),m=`${n}#${t+l/f}`;this.cache.has(m)||(this.cache.set(m,u),this.cached+=u.length)}const d=this.cache.get(s)??o.subarray(0,f);for(;this.cached>Q&&this.cache.size>1;){const l=this.cache.keys().next().value;this.cached-=this.cache.get(l)?.length??0,this.cache.delete(l)}return d}async warm(n,t=256*1024*1024){let r=0;for(const s of n)for(let a=0;a*f<s.size;a+=M){if(r>=t)return;const i=`${s.url}#${a}`;if(this.cache.has(i))continue;const o=a*f,d=Math.min(o+f*M,s.size)-1;try{const l=s.handle?new Uint8Array(await(await s.handle.getFile()).slice(o,d+1).arrayBuffer()):new Uint8Array(await(await fetch(s.url,{headers:{Range:`bytes=${o}-${d}`}})).arrayBuffer());for(let u=0;u<l.length;u+=f){const m=`${s.url}#${a+u/f}`;if(this.cache.has(m))continue;const p=l.subarray(u,Math.min(u+f,l.length));this.cache.set(m,p),this.cached+=p.length}r+=l.length}catch{return}await new Promise(l=>setTimeout(l,0))}}mount(n,t){const r=n.FS;r.mkdirTree(t.mount);const s=r.createFile(t.mount,t.name,{},!0,!1),a=t.size;Object.defineProperty(s,"usedBytes",{get:()=>a}),s.stream_ops={llseek:(i,o,d)=>{let l=o;if(d===1?l+=i.position:d===2&&(l=a+o),l<0)throw new r.ErrnoError(28);return l},read:(i,o,d,l,u)=>{const m=Math.min(a,u+l);if(u>=m)return 0;const p=Math.floor(u/f),G=Math.floor((m-1)/f);let x=0;for(let A=p;A<=G;A+=1){const U=this.takeChunk(t.url,A,t.handle),L=A*f,O=Math.max(u,L)-L,R=Math.min(m,L+U.length)-L;if(R<=O)break;o.set(U.subarray(O,R),d+x),x+=R-O}return x}}}}async function ne(){return await(await fetch("/GeneralsXAssets")).json()}async function se(e,n=3){const t=new Map,r=async(s,a)=>{let i=!1,o=!1;const d=[];for await(const[l,u]of s.entries())u.kind==="directory"?d.push(u):l.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(l)?i=!0:o=!0);if(i&&!t.has("GeneralsZH")?t.set("GeneralsZH",s):o&&!i&&!t.has("Generals")&&t.set("Generals",s),!(t.size===2||a>=n)){for(const l of d)if(await r(l,a+1),t.size===2)return}};return await r(e,0),t}async function re(){try{return await ae()}catch(e){return console.debug("local archives unavailable",e),[]}}async function ae(){const n=(await new Promise((a,i)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>a(o.result),o.onerror=()=>i(o.error)})).transaction("handles","readonly").objectStore("handles"),t=a=>new Promise(i=>{const o=n.get(a);o.onsuccess=()=>i(o.result),o.onerror=()=>i(void 0)}),r={GeneralsZH:t("GeneralsZH"),Generals:t("Generals")},s=[];for(const a of["GeneralsZH","Generals"]){const i=await r[a];if(i){if(await i.queryPermission?.({mode:"read"})!=="granted"&&await i.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,d]of i.entries()){if(!o.toLowerCase().endsWith(".big")||d.kind!=="file")continue;const l=await d.getFile();s.push({mount:`/${a}`,name:o,url:`local:${a}/${o}`,size:l.size,handle:d})}}}return s}async function oe(){try{const e=await new Promise((n,t)=>{const r=indexedDB.open("generalsx",1);r.onupgradeneeded=()=>r.result.createObjectStore("handles"),r.onsuccess=()=>n(r.result),r.onerror=()=>t(r.error)});return await new Promise(n=>{const t=e.transaction("handles","readonly").objectStore("handles").count();t.onsuccess=()=>n(t.result>0),t.onerror=()=>n(!1)})}catch{return!1}}const ie=`
  <p>If Steam is installed in the default location on drive C:</p>
  <p><strong>Command &amp; Conquer: Generals</strong><br>
     <code class="text-hud-warm break-all">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Command and Conquer Generals\\</code></p>
  <p><strong>Generals: Zero Hour</strong><br>
     <code class="text-hud-warm break-all">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Command &amp; Conquer Generals - Zero Hour\\</code></p>
  <p>The main executable is <code class="text-hud-warm">Generals.exe</code>. To open the folder directly:
     Steam → Library → right-click the game → Manage → Browse local files.</p>
  <p>On macOS or Linux, pick the folder holding the game's <code class="text-hud-warm">.big</code> archives
     (<code class="text-hud-warm">INIZH.big</code>, <code class="text-hud-warm">TexturesZH.big</code>,
     <code class="text-hud-warm">AudioZH.big</code>…). Select the <strong>Zero Hour</strong> folder first;
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function le(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
    <header class="flex min-h-[58px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hud-border bg-hud-surface px-3 py-2 shadow-[0_0_18px_hsl(188_100%_50%/.12)] sm:px-10">
      <div class="flex items-baseline gap-3">
        <h1 class="m-0 text-[clamp(18px,2.4vw,26px)] uppercase tracking-[0.14em] text-hud-accent [text-shadow:0_0_12px_hsl(188_100%_50%/.55)]">GeneralsX</h1>
        <p class="m-0 hidden text-sm text-hud-muted sm:block">WebAssembly + WebGPU</p>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden lg:inline">Display</span>
            <select id="aspect" class="hud-select"><option value="16:9">16:9</option><option value="4:3">4:3</option></select>
          </label>
          <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden lg:inline">Boot</span>
            <select id="boot" class="hud-select">
              <option value="fast">Fast start</option>
              <option value="full">Full start</option>
            </select>
          </label>
        </div>
        <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button id="share" hidden class="hud-button whitespace-nowrap" title="Copy the link for players on your network">Multiplayer</button>
          <button id="sound" class="hud-button whitespace-nowrap">Sound on</button>
          <button id="fullscreen" class="hud-button whitespace-nowrap">Fullscreen</button>
          <button id="reset" class="hud-button whitespace-nowrap" title="Clear saved settings and ownership, then reload">Reset</button>
        </div>
      </div>
    </header>

    <main class="flex min-h-0 w-full flex-1 flex-col gap-2.5 px-2 py-2.5 sm:px-6">
      <section class="hud-cut flex min-h-[52px] flex-wrap items-center justify-between gap-2 px-3.5 py-2" style="--hud-cut-surface: var(--color-hud-surface)">
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-3">
            <span id="status" role="status" aria-live="polite" class="text-sm font-bold">Starting…</span>
            <span id="status-detail" class="truncate text-xs text-hud-muted"></span>
          </div>
          <div id="progress-track" hidden class="mt-1 h-1 w-full bg-hud-raised">
            <div id="progress-bar" class="h-full w-0 bg-hud-accent transition-[width] duration-150"></div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span id="cap-wasm" class="border-l-[3px] border-hud-border bg-hud-raised px-2 py-1 text-xs text-hud-muted">WASM</span>
          <span id="cap-webgpu" class="border-l-[3px] border-hud-border bg-hud-raised px-2 py-1 text-xs text-hud-muted">WebGPU</span>
        </div>
      </section>

      <div id="stage" class="grid min-h-0 w-full min-w-0 flex-1 place-items-center overflow-hidden">
        <section id="frame" class="hud-cut relative grid min-w-0 place-items-center p-2" style="--hud-cut-surface: #000">
          <canvas id="canvas" tabindex="0" class="block border-0 bg-black"></canvas>
          <img id="cursor-overlay" alt="" hidden class="pointer-events-none fixed left-0 top-0 z-[5] [image-rendering:pixelated]">

          <div id="firstrun" hidden class="absolute inset-0 z-[6] grid place-items-center bg-[hsl(210_100%_2%/.94)] p-4">
            <div class="hud-cut max-h-full max-w-4xl overflow-auto p-4 text-left sm:p-7" style="--hud-cut-surface: var(--color-hud-raised)">
              <h2 class="m-0 mb-2 uppercase tracking-[0.12em] text-hud-accent [text-shadow:0_0_12px_hsl(188_100%_50%/.5)]">Load your game files</h2>
              <p class="mb-5 text-[13px] text-hud-muted">GeneralsX runs your own copy of
                 <strong>Command &amp; Conquer Generals — Zero Hour</strong>. Nothing is downloaded:</p>
              <div class="border border-hud-border bg-[hsl(210_100%_4%)] p-4">
                <h3 class="m-0 mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.08em] text-hud-accent">
                  Select your game folder
                  <button id="firstrun-info" aria-label="Where to find the game folder"
                          class="hud-button h-5 min-h-5 w-5 rounded-full px-0 text-xs [clip-path:none]">i</button>
                </h3>
                <p class="text-[13px] text-hud-muted">Point the browser at your installed copy. The files stay on your machine.</p>
                <button id="firstrun-folder" class="hud-button mt-2">Select game folder</button>
                <p id="firstrun-folder-note" class="min-h-4 text-xs text-hud-warm"></p>
              </div>
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${ie}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const c=e=>document.getElementById(e);le(c("app"));const h=c("canvas"),$=c("frame"),X=c("stage"),F=c("output"),ce=c("status"),y=c("cursor-overlay"),S=new URLSearchParams(location.search),T="/home/web_user/.local/share/GeneralsX/GeneralsZH",de=`Resolution = 1280 720
`,E=[],C=[];let j=Promise.resolve();function g(e){E.push(e),C.push(e),C.length>512&&C.shift(),F.value=`${C.join(`
`)}
`,F.scrollTop=F.scrollHeight}function W(e=!1){if(!E.length)return;const n=`${E.join(`
`)}
`;if(E.length=0,e){navigator.sendBeacon("/GeneralsXLog",n);return}j=j.then(()=>fetch("/GeneralsXLog",{method:"POST",body:n}).catch(()=>{}))}setInterval(()=>W(),2e3);addEventListener("pagehide",()=>W(!0));const ue=c("status-detail"),he=c("progress-track"),fe=c("progress-bar");function b(e,n="",t){e&&(ce.textContent=e),ue.textContent=n,he.hidden=t===void 0,t!==void 0&&(fe.style.width=`${Math.round(Math.min(1,Math.max(0,t))*100)}%`)}const P=e=>{const n=/\((\d+)\/(\d+)\)/.exec(e);if(n){const t=Number(n[1]),r=Number(n[2]);b("Loading runtime",`${(t/2**20).toFixed(1)} / ${(r/2**20).toFixed(1)} MB`,t/r);return}e&&b(e)},q=(S.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",me=S.get("sound")!=="0";let I=localStorage.getItem("generalsX.soundMuted")==="1";const z=q==="fast"?["-quickstart","-noshellmap"]:[];me||z.push("-noaudio");c("boot").value=q;c("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const H=c("aspect");H.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";H.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",H.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});c("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});c("share").addEventListener("click",async()=>{const e=c("share"),{url:n}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(n).catch(()=>{});const t=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=t},1800)});c("firstrun-info").addEventListener("click",()=>{const e=c("firstrun-info-panel");e.hidden=!e.hidden});c("firstrun-folder").addEventListener("click",async()=>{const e=c("firstrun-folder-note"),n=window.showDirectoryPicker;if(!n){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const t=await n({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const r=await se(t);if(!r.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const a=(await new Promise((i,o)=>{const d=indexedDB.open("generalsx",1);d.onupgradeneeded=()=>d.result.createObjectStore("handles"),d.onsuccess=()=>i(d.result),d.onerror=()=>o(d.error)})).transaction("handles","readwrite").objectStore("handles");for(const[i,o]of r)a.put(o,i);e.textContent=`Found ${[...r.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(t){console.debug("folder selection cancelled",t),e.textContent=""}});function k(){const e=document.fullscreenElement===$,n=Math.min(e?innerWidth:X.clientWidth,innerWidth)-16,t=Math.min(e?innerHeight:X.clientHeight,innerHeight)-16,r=Math.min(n/(h.width||1),t/(h.height||1));h.style.width=`${Math.max(1,Math.floor((h.width||1)*r))}px`,h.style.height=`${Math.max(1,Math.floor((h.height||1)*r))}px`}new ResizeObserver(k).observe(X);new MutationObserver(k).observe(h,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",k);document.addEventListener("fullscreenchange",k);c("fullscreen").addEventListener("click",()=>void $.requestFullscreen().catch(()=>{}));let B="";function Z(){if(document.pointerLockElement!==h)return;const e=w?._GeneralsXMouseX?.()??-1,n=w?._GeneralsXMouseY?.()??-1,t=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(h.style.cursor);if(t&&e>=0&&n>=0){const[,r,s="0",a="0"]=t;r!==B&&(B=r,y.src=r);const i=h.getBoundingClientRect(),o=i.width/(h.width||1),d=i.height/(h.height||1);y.hidden=!1,y.style.transform=`translate(${i.left+e*o-Number(s)}px, ${i.top+n*d-Number(a)}px)`}else y.hidden=!0;requestAnimationFrame(Z)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===h;h.classList.toggle("pointer-locked",e),e?Z():y.hidden=!0});h.addEventListener("contextmenu",e=>e.preventDefault());h.addEventListener("pointerdown",()=>{h.focus(),!document.pointerLockElement&&$.dataset.ready==="true"&&h.requestPointerLock()});function pe(e){I=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),w?._GeneralsXSetAudioMuted?.(e?1:0),c("sound").textContent=e?"Sound off":"Sound on"}c("sound").addEventListener("click",()=>pe(!I));c("sound").textContent=I?"Sound off":"Sound on";crossOriginIsolated||P("Open this page over https:// — the browser blocks shared memory otherwise.");const v=["","emscripten","wasm","Reporting","YesSir","MoveOut","Affirmative","Rockets","OnTheWay","TargetSighted","ForTheMotherland","DeathFromAbove","AtOnce","IObey","ChinaWillGrow","GLAWillPrevail","USAWillProtect","AwaitingOrders","InPosition","TakingFire","ChargeTheAttack","ScudLaunch","AirForceOne","Overlord","Toxin"];function ge(){let e=Number(localStorage.getItem("generalsX.lanOffset"));e||(e=Math.floor(Math.random()*(v.length-1))+1,localStorage.setItem("generalsX.lanOffset",String(e)));const n=new Set((localStorage.getItem("generalsX.lanUsed")??"").split(",").filter(Boolean).map(Number));for(let t=0;t<v.length-1;t+=1){const r=(e-1+t)%(v.length-1)+1;if(!n.has(r))return n.add(r),localStorage.setItem("generalsX.lanUsed",[...n].join(",")),r}return Math.floor(Math.random()*(v.length-1))+1}const _=new te(g,(e,n)=>b("",e,n));function N(e){const n=e.filter(r=>/^(audio|music|speech)/i.test(r.name)),t=n.reduce((r,s)=>r+s.size,0);_.warm(n,t,(r,s)=>b("",`Caching audio · ${s} · ${(r/2**20).toFixed(0)}/${(t/2**20).toFixed(0)} MB`,r/t)).then(()=>{b("Running",""),g("Audio archives cached locally.")})}let w;c("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";c("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const K={canvas:h,arguments:z,print:e=>g(e),printErr:e=>g(e),setStatus:P,preRun:[e=>{if(e.addRunDependency("gx-assets"),S.get("assets")==="1"){c("firstrun").hidden=!1;return}Promise.all([re(),_.ready]).then(async([n])=>{if(n.length){for(const s of n)_.mount(e,s);N(n),g(`Streaming ${n.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await oe()){c("firstrun").hidden=!1,c("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const t=await ne();if(b("Mounting archives",`${t.entries.length} files`),t.missing){c("firstrun").hidden=!1,g("Game archives not found — waiting for the player to point at their install.");return}for(const s of t.entries)_.mount(e,s);N(t.entries);const r=t.entries.reduce((s,a)=>s+a.size,0);g(`Streaming ${t.entries.length} game archives (${(r/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(n=>{g(`Asset manifest failed: ${n.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const n=e.FS;n.mkdirTree(T),n.mount(e.IDBFS,{},T),n.syncfs(!0,()=>{const t=`${T}/Options.ini`;let r=!0;try{n.stat(t)}catch{r=!1}if((!r||S.get("resetOptions")==="1")&&n.writeFile(t,de),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",a=n.readFile(t,{encoding:"utf8"});n.writeFile(t,/^Resolution = /m.test(a)?a.replace(/^Resolution = .*$/m,s):`${a}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>n.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>n.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};K.onRuntimeInitialized=function(){w=this,globalThis.__gx=this,$.dataset.ready="true";const e=sessionStorage.getItem("generalsX.lanClient"),n=Number(S.get("lanClient")??e??0)||ge();sessionStorage.setItem("generalsX.lanClient",String(n)),c("share").hidden=!1,b("Running","");const t=v[n]??`Player${n}`,r=setInterval(()=>{w?.ccall?.("GeneralsXLanSetName","number",["string"],[t])&&clearInterval(r)},500);if(P("Running"),k(),I){const s=setInterval(()=>{w?._GeneralsXSetAudioMuted?.(1)&&clearInterval(s)},500)}};P("Loading…");const be=(await J(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;be(K);
