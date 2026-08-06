(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Y="modulepreload",K=function(e){return"/"+e},F={},V=function(n,t,a){let s=Promise.resolve();if(t&&t.length>0){let i=function(l){return Promise.all(l.map(h=>Promise.resolve(h).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),d=o?.nonce||o?.getAttribute("nonce");s=i(t.map(l=>{if(l=K(l),l in F)return;F[l]=!0;const h=l.endsWith(".css"),f=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${f}`))return;const p=document.createElement("link");if(p.rel=h?"stylesheet":Y,h||(p.as="script"),p.crossOrigin="",p.href=l,d&&p.setAttribute("nonce",d),document.head.appendChild(p),h)return new Promise((P,w)=>{p.addEventListener("load",P),p.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(i){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=i,window.dispatchEvent(o),!o.defaultPrevented)throw i}return s.then(i=>{for(const o of i||[])o.status==="rejected"&&r(o.reason);return n().catch(r)})},m=256*1024,J=384*1024*1024,D=8,Q=`
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
  };`;class ee{constructor(n){if(this.onError=n,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([Q],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(m*D+8),this.ready=new Promise(t=>this.worker?.addEventListener("message",t,{once:!0}))}cache=new Map;cached=0;nextIndex=new Map;worker=null;buffer=null;ready;fetchChunkSync(n,t,a,s=1){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const r=new Int32Array(this.buffer,0,2);Atomics.store(r,0,0);const i=t*m;this.worker.postMessage({url:a?"":new URL(n,location.href).href,handle:a,start:i,end:i+m*s-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(r,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${n} chunk ${t}`),new Uint8Array(0);return Atomics.load(r,0)!==1?(this.onError(`Archive fetch failed: ${n} chunk ${t}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(r[1]??0)))}takeChunk(n,t,a){const s=`${n}#${t}`,r=this.cache.get(s);if(r)return this.cache.delete(s),this.cache.set(s,r),r;const i=this.nextIndex.get(n)===t,o=this.fetchChunkSync(n,t,a,i?D:1);this.nextIndex.set(n,t+o.length/m);for(let l=0;l<o.length;l+=m){const h=o.subarray(l,Math.min(l+m,o.length)),f=`${n}#${t+l/m}`;this.cache.has(f)||(this.cache.set(f,h),this.cached+=h.length)}const d=this.cache.get(s)??o.subarray(0,m);for(;this.cached>J&&this.cache.size>1;){const l=this.cache.keys().next().value;this.cached-=this.cache.get(l)?.length??0,this.cache.delete(l)}return d}mount(n,t){const a=n.FS;a.mkdirTree(t.mount);const s=a.createFile(t.mount,t.name,{},!0,!1),r=t.size;Object.defineProperty(s,"usedBytes",{get:()=>r}),s.stream_ops={llseek:(i,o,d)=>{let l=o;if(d===1?l+=i.position:d===2&&(l=r+o),l<0)throw new a.ErrnoError(28);return l},read:(i,o,d,l,h)=>{const f=Math.min(r,h+l);if(h>=f)return 0;const p=Math.floor(h/m),P=Math.floor((f-1)/m);let w=0;for(let k=p;k<=P;k+=1){const H=this.takeChunk(t.url,k,t.handle),A=k*m,I=Math.max(h,A)-A,G=Math.min(f,A+H.length)-A;if(G<=I)break;o.set(H.subarray(I,G),d+w),w+=G-I}return w}}}}async function te(){return await(await fetch("/GeneralsXAssets")).json()}async function ne(e,n=3){const t=new Map,a=async(s,r)=>{let i=!1,o=!1;const d=[];for await(const[l,h]of s.entries())h.kind==="directory"?d.push(h):l.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(l)?i=!0:o=!0);if(i&&!t.has("GeneralsZH")?t.set("GeneralsZH",s):o&&!i&&!t.has("Generals")&&t.set("Generals",s),!(t.size===2||r>=n)){for(const l of d)if(await a(l,r+1),t.size===2)return}};return await a(e,0),t}async function se(){try{return await re()}catch(e){return console.debug("local archives unavailable",e),[]}}async function re(){const n=(await new Promise((r,i)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>r(o.result),o.onerror=()=>i(o.error)})).transaction("handles","readonly").objectStore("handles"),t=r=>new Promise(i=>{const o=n.get(r);o.onsuccess=()=>i(o.result),o.onerror=()=>i(void 0)}),a={GeneralsZH:t("GeneralsZH"),Generals:t("Generals")},s=[];for(const r of["GeneralsZH","Generals"]){const i=await a[r];if(i){if(await i.queryPermission?.({mode:"read"})!=="granted"&&await i.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,d]of i.entries()){if(!o.toLowerCase().endsWith(".big")||d.kind!=="file")continue;const l=await d.getFile();s.push({mount:`/${r}`,name:o,url:`local:${r}/${o}`,size:l.size,handle:d})}}}return s}async function ae(){try{const e=await new Promise((n,t)=>{const a=indexedDB.open("generalsx",1);a.onupgradeneeded=()=>a.result.createObjectStore("handles"),a.onsuccess=()=>n(a.result),a.onerror=()=>t(a.error)});return await new Promise(n=>{const t=e.transaction("handles","readonly").objectStore("handles").count();t.onsuccess=()=>n(t.result>0),t.onerror=()=>n(!1)})}catch{return!1}}const oe=`
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function ie(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
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
        <span id="status" role="status" aria-live="polite" class="text-sm font-bold">Starting…</span>
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
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${oe}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const c=e=>document.getElementById(e);ie(c("app"));const u=c("canvas"),E=c("frame"),X=c("stage"),O=c("output"),U=c("status"),x=c("cursor-overlay"),v=new URLSearchParams(location.search),$="/home/web_user/.local/share/GeneralsX/GeneralsZH",le=`Resolution = 1280 720
`,C=[],L=[];let j=Promise.resolve();function g(e){C.push(e),L.push(e),L.length>512&&L.shift(),O.value=`${L.join(`
`)}
`,O.scrollTop=O.scrollHeight}function q(e=!1){if(!C.length)return;const n=`${C.join(`
`)}
`;if(C.length=0,e){navigator.sendBeacon("/GeneralsXLog",n);return}j=j.then(()=>fetch("/GeneralsXLog",{method:"POST",body:n}).catch(()=>{}))}setInterval(()=>q(),2e3);addEventListener("pagehide",()=>q(!0));const M=e=>{U.textContent=e||U.textContent||""},N=(v.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",ce=v.get("sound")!=="0";let _=localStorage.getItem("generalsX.soundMuted")==="1";const B=N==="fast"?["-quickstart","-noshellmap"]:[];ce||B.push("-noaudio");c("boot").value=N;c("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const T=c("aspect");T.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";T.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",T.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});c("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});c("share").addEventListener("click",async()=>{const e=c("share"),{url:n}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(n).catch(()=>{});const t=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=t},1800)});c("firstrun-info").addEventListener("click",()=>{const e=c("firstrun-info-panel");e.hidden=!e.hidden});c("firstrun-folder").addEventListener("click",async()=>{const e=c("firstrun-folder-note"),n=window.showDirectoryPicker;if(!n){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const t=await n({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const a=await ne(t);if(!a.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const r=(await new Promise((i,o)=>{const d=indexedDB.open("generalsx",1);d.onupgradeneeded=()=>d.result.createObjectStore("handles"),d.onsuccess=()=>i(d.result),d.onerror=()=>o(d.error)})).transaction("handles","readwrite").objectStore("handles");for(const[i,o]of a)r.put(o,i);e.textContent=`Found ${[...a.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(t){console.debug("folder selection cancelled",t),e.textContent=""}});function S(){const e=document.fullscreenElement===E,n=Math.min(e?innerWidth:X.clientWidth,innerWidth)-16,t=Math.min(e?innerHeight:X.clientHeight,innerHeight)-16,a=Math.min(n/(u.width||1),t/(u.height||1));u.style.width=`${Math.max(1,Math.floor((u.width||1)*a))}px`,u.style.height=`${Math.max(1,Math.floor((u.height||1)*a))}px`}new ResizeObserver(S).observe(X);new MutationObserver(S).observe(u,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",S);document.addEventListener("fullscreenchange",S);c("fullscreen").addEventListener("click",()=>void E.requestFullscreen().catch(()=>{}));let W="";function Z(){if(document.pointerLockElement!==u)return;const e=b?._GeneralsXMouseX?.()??-1,n=b?._GeneralsXMouseY?.()??-1,t=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(u.style.cursor);if(t&&e>=0&&n>=0){const[,a,s="0",r="0"]=t;a!==W&&(W=a,x.src=a);const i=u.getBoundingClientRect(),o=i.width/(u.width||1),d=i.height/(u.height||1);x.hidden=!1,x.style.transform=`translate(${i.left+e*o-Number(s)}px, ${i.top+n*d-Number(r)}px)`}else x.hidden=!0;requestAnimationFrame(Z)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===u;u.classList.toggle("pointer-locked",e),e?Z():x.hidden=!0});u.addEventListener("contextmenu",e=>e.preventDefault());u.addEventListener("pointerdown",()=>{u.focus(),!document.pointerLockElement&&E.dataset.ready==="true"&&u.requestPointerLock()});function de(e){_=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),b?._GeneralsXSetAudioMuted?.(e?1:0),c("sound").textContent=e?"Sound off":"Sound on"}c("sound").addEventListener("click",()=>de(!_));c("sound").textContent=_?"Sound off":"Sound on";crossOriginIsolated||M("Open this page over https:// — the browser blocks shared memory otherwise.");const y=["","emscripten","wasm","Reporting","YesSir","MoveOut","Affirmative","Rockets","OnTheWay","TargetSighted","ForTheMotherland","DeathFromAbove","AtOnce","IObey","ChinaWillGrow","GLAWillPrevail","USAWillProtect","AwaitingOrders","InPosition","TakingFire","ChargeTheAttack","ScudLaunch","AirForceOne","Overlord","Toxin"];function ue(){let e=Number(localStorage.getItem("generalsX.lanOffset"));e||(e=Math.floor(Math.random()*(y.length-1))+1,localStorage.setItem("generalsX.lanOffset",String(e)));const n=new Set((localStorage.getItem("generalsX.lanUsed")??"").split(",").filter(Boolean).map(Number));for(let t=0;t<y.length-1;t+=1){const a=(e-1+t)%(y.length-1)+1;if(!n.has(a))return n.add(a),localStorage.setItem("generalsX.lanUsed",[...n].join(",")),a}return Math.floor(Math.random()*(y.length-1))+1}const R=new ee(g);let b;c("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";c("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const z={canvas:u,arguments:B,print:e=>g(e),printErr:e=>g(e),setStatus:M,preRun:[e=>{if(e.addRunDependency("gx-assets"),v.get("assets")==="1"){c("firstrun").hidden=!1;return}Promise.all([se(),R.ready]).then(async([n])=>{if(n.length){for(const s of n)R.mount(e,s);g(`Streaming ${n.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await ae()){c("firstrun").hidden=!1,c("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const t=await te();if(t.missing){c("firstrun").hidden=!1,g("Game archives not found — waiting for the player to point at their install.");return}for(const s of t.entries)R.mount(e,s);const a=t.entries.reduce((s,r)=>s+r.size,0);g(`Streaming ${t.entries.length} game archives (${(a/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(n=>{g(`Asset manifest failed: ${n.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const n=e.FS;n.mkdirTree($),n.mount(e.IDBFS,{},$),n.syncfs(!0,()=>{const t=`${$}/Options.ini`;let a=!0;try{n.stat(t)}catch{a=!1}if((!a||v.get("resetOptions")==="1")&&n.writeFile(t,le),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",r=n.readFile(t,{encoding:"utf8"});n.writeFile(t,/^Resolution = /m.test(r)?r.replace(/^Resolution = .*$/m,s):`${r}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>n.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>n.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};z.onRuntimeInitialized=function(){b=this,globalThis.__gx=this,E.dataset.ready="true";const e=sessionStorage.getItem("generalsX.lanClient"),n=Number(v.get("lanClient")??e??0)||ue();sessionStorage.setItem("generalsX.lanClient",String(n)),c("share").hidden=!1;const t=y[n]??`Player${n}`,a=setInterval(()=>{b?.ccall?.("GeneralsXLanSetName","number",["string"],[t])&&clearInterval(a)},500);if(M("Running"),S(),_){const s=setInterval(()=>{b?._GeneralsXSetAudioMuted?.(1)&&clearInterval(s)},500)}};M("Loading…");const he=(await V(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;he(z);
