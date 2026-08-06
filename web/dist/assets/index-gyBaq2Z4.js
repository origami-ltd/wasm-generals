(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function n(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(s){if(s.ep)return;s.ep=!0;const r=n(s);fetch(s.href,r)}})();const z="modulepreload",Y=function(e){return"/"+e},F={},K=function(t,n,a){let s=Promise.resolve();if(n&&n.length>0){let i=function(d){return Promise.all(d.map(h=>Promise.resolve(h).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),l=o?.nonce||o?.getAttribute("nonce");s=i(n.map(d=>{if(d=Y(d),d in F)return;F[d]=!0;const h=d.endsWith(".css"),m=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${m}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":z,h||(f.as="script"),f.crossOrigin="",f.href=d,l&&f.setAttribute("nonce",l),document.head.appendChild(f),h)return new Promise((M,w)=>{f.addEventListener("load",M),f.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${d}`)))})}))}function r(i){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=i,window.dispatchEvent(o),!o.defaultPrevented)throw i}return s.then(i=>{for(const o of i||[])o.status==="rejected"&&r(o.reason);return t().catch(r)})},g=4*1024*1024,V=192*1024*1024,J=`
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
  };`;class Q{constructor(t){if(this.onError=t,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([J],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(g+8),this.ready=new Promise(n=>this.worker?.addEventListener("message",n,{once:!0}))}cache=new Map;worker=null;buffer=null;ready;fetchChunkSync(t,n,a){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const s=new Int32Array(this.buffer,0,2);Atomics.store(s,0,0);const r=n*g;this.worker.postMessage({url:a?"":new URL(t,location.href).href,handle:a,start:r,end:r+g-1,sab:this.buffer});const i=Date.now()+6e4;for(;Atomics.load(s,0)===0;)if(Date.now()>i)return this.onError(`Archive fetch timed out: ${t} chunk ${n}`),new Uint8Array(0);return Atomics.load(s,0)!==1?(this.onError(`Archive fetch failed: ${t} chunk ${n}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(s[1]??0)))}takeChunk(t,n,a){const s=`${t}#${n}`,r=this.cache.get(s);if(r)return this.cache.delete(s),this.cache.set(s,r),r;const i=this.fetchChunkSync(t,n,a);this.cache.set(s,i);let o=0;for(const l of this.cache.values())o+=l.length;for(;o>V&&this.cache.size>1;){const l=this.cache.keys().next().value;o-=this.cache.get(l)?.length??0,this.cache.delete(l)}return i}mount(t,n){const a=t.FS;a.mkdirTree(n.mount);const s=a.createFile(n.mount,n.name,{},!0,!1),r=n.size;Object.defineProperty(s,"usedBytes",{get:()=>r}),s.stream_ops={llseek:(i,o,l)=>{let d=o;if(l===1?d+=i.position:l===2&&(d=r+o),d<0)throw new a.ErrnoError(28);return d},read:(i,o,l,d,h)=>{const m=Math.min(r,h+d);if(h>=m)return 0;const f=Math.floor(h/g),M=Math.floor((m-1)/g);let w=0;for(let S=f;S<=M;S+=1){const X=this.takeChunk(n.url,S,n.handle),k=S*g,P=Math.max(h,k)-k,G=Math.min(m,k+X.length)-k;if(G<=P)break;o.set(X.subarray(P,G),l+w),w+=G-P}return w}}}}async function ee(){return await(await fetch("/GeneralsXAssets")).json()}async function te(e,t=3){const n=new Map,a=async(s,r)=>{let i=!1,o=!1;const l=[];for await(const[d,h]of s.entries())h.kind==="directory"?l.push(h):d.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(d)?i=!0:o=!0);if(i&&!n.has("GeneralsZH")?n.set("GeneralsZH",s):o&&!i&&!n.has("Generals")&&n.set("Generals",s),!(n.size===2||r>=t)){for(const d of l)if(await a(d,r+1),n.size===2)return}};return await a(e,0),n}async function ne(){try{return await se()}catch(e){return console.debug("local archives unavailable",e),[]}}async function se(){const t=(await new Promise((r,i)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>r(o.result),o.onerror=()=>i(o.error)})).transaction("handles","readonly").objectStore("handles"),n=r=>new Promise(i=>{const o=t.get(r);o.onsuccess=()=>i(o.result),o.onerror=()=>i(void 0)}),a={GeneralsZH:n("GeneralsZH"),Generals:n("Generals")},s=[];for(const r of["GeneralsZH","Generals"]){const i=await a[r];if(i){if(await i.queryPermission?.({mode:"read"})!=="granted"&&await i.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,l]of i.entries()){if(!o.toLowerCase().endsWith(".big")||l.kind!=="file")continue;const d=await l.getFile();s.push({mount:`/${r}`,name:o,url:`local:${r}/${o}`,size:d.size,handle:l})}}}return s}async function re(){try{const e=await new Promise((t,n)=>{const a=indexedDB.open("generalsx",1);a.onupgradeneeded=()=>a.result.createObjectStore("handles"),a.onsuccess=()=>t(a.result),a.onerror=()=>n(a.error)});return await new Promise(t=>{const n=e.transaction("handles","readonly").objectStore("handles").count();n.onsuccess=()=>t(n.result>0),n.onerror=()=>t(!1)})}catch{return!1}}const ae=`
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function oe(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
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
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${ae}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const c=e=>document.getElementById(e);oe(c("app"));const u=c("canvas"),C=c("frame"),R=c("stage"),I=c("output"),H=c("status"),x=c("cursor-overlay"),y=new URLSearchParams(location.search),O="/home/web_user/.local/share/GeneralsX/GeneralsZH",ie=`Resolution = 1280 720
`,A=[],L=[];let U=Promise.resolve();function p(e){A.push(e),L.push(e),L.length>512&&L.shift(),I.value=`${L.join(`
`)}
`,I.scrollTop=I.scrollHeight}function D(e=!1){if(!A.length)return;const t=`${A.join(`
`)}
`;if(A.length=0,e){navigator.sendBeacon("/GeneralsXLog",t);return}U=U.then(()=>fetch("/GeneralsXLog",{method:"POST",body:t}).catch(()=>{}))}setInterval(()=>D(),2e3);addEventListener("pagehide",()=>D(!0));const E=e=>{H.textContent=e||H.textContent||""},W=(y.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",le=y.get("sound")!=="0";let _=localStorage.getItem("generalsX.soundMuted")==="1";const q=W==="fast"?["-quickstart","-noshellmap"]:[];le||q.push("-noaudio");c("boot").value=W;c("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const T=c("aspect");T.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";T.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",T.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});c("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});c("share").addEventListener("click",async()=>{const e=c("share"),{url:t}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(t).catch(()=>{});const n=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=n},1800)});c("firstrun-info").addEventListener("click",()=>{const e=c("firstrun-info-panel");e.hidden=!e.hidden});c("firstrun-folder").addEventListener("click",async()=>{const e=c("firstrun-folder-note"),t=window.showDirectoryPicker;if(!t){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const n=await t({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const a=await te(n);if(!a.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const r=(await new Promise((i,o)=>{const l=indexedDB.open("generalsx",1);l.onupgradeneeded=()=>l.result.createObjectStore("handles"),l.onsuccess=()=>i(l.result),l.onerror=()=>o(l.error)})).transaction("handles","readwrite").objectStore("handles");for(const[i,o]of a)r.put(o,i);e.textContent=`Found ${[...a.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(n){console.debug("folder selection cancelled",n),e.textContent=""}});function v(){const e=document.fullscreenElement===C,t=Math.min(e?innerWidth:R.clientWidth,innerWidth)-16,n=Math.min(e?innerHeight:R.clientHeight,innerHeight)-16,a=Math.min(t/(u.width||1),n/(u.height||1));u.style.width=`${Math.max(1,Math.floor((u.width||1)*a))}px`,u.style.height=`${Math.max(1,Math.floor((u.height||1)*a))}px`}new ResizeObserver(v).observe(R);new MutationObserver(v).observe(u,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",v);document.addEventListener("fullscreenchange",v);c("fullscreen").addEventListener("click",()=>void C.requestFullscreen().catch(()=>{}));let j="";function B(){if(document.pointerLockElement!==u)return;const e=b?._GeneralsXMouseX?.()??-1,t=b?._GeneralsXMouseY?.()??-1,n=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(u.style.cursor);if(n&&e>=0&&t>=0){const[,a,s="0",r="0"]=n;a!==j&&(j=a,x.src=a);const i=u.getBoundingClientRect(),o=i.width/(u.width||1),l=i.height/(u.height||1);x.hidden=!1,x.style.transform=`translate(${i.left+e*o-Number(s)}px, ${i.top+t*l-Number(r)}px)`}else x.hidden=!0;requestAnimationFrame(B)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===u;u.classList.toggle("pointer-locked",e),e?B():x.hidden=!0});u.addEventListener("contextmenu",e=>e.preventDefault());u.addEventListener("pointerdown",()=>{u.focus(),!document.pointerLockElement&&C.dataset.ready==="true"&&u.requestPointerLock()});function ce(e){_=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),b?._GeneralsXSetAudioMuted?.(e?1:0),c("sound").textContent=e?"Sound off":"Sound on"}c("sound").addEventListener("click",()=>ce(!_));c("sound").textContent=_?"Sound off":"Sound on";crossOriginIsolated||E("Open this page over https:// — the browser blocks shared memory otherwise.");const N=["","emscripten","wasm","Reporting","YesSir","MoveOut","Affirmative","Rockets","OnTheWay","TargetSighted","ForTheMotherland","DeathFromAbove","AtOnce","IObey","ChinaWillGrow","GLAWillPrevail","USAWillProtect","AwaitingOrders","InPosition","TakingFire","ChargeTheAttack","ScudLaunch","AirForceOne","Overlord","Toxin"];function de(){const e=new Set((localStorage.getItem("generalsX.lanUsed")??"").split(",").filter(Boolean).map(Number));for(let t=1;t<N.length;t+=1)if(!e.has(t))return e.add(t),localStorage.setItem("generalsX.lanUsed",[...e].join(",")),t;return Math.floor(Math.random()*254)+1}const $=new Q(p);let b;c("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";c("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const Z={canvas:u,arguments:q,print:e=>p(e),printErr:e=>p(e),setStatus:E,preRun:[e=>{if(e.addRunDependency("gx-assets"),y.get("assets")==="1"){c("firstrun").hidden=!1;return}Promise.all([ne(),$.ready]).then(async([t])=>{if(t.length){for(const s of t)$.mount(e,s);p(`Streaming ${t.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await re()){c("firstrun").hidden=!1,c("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const n=await ee();if(n.missing){c("firstrun").hidden=!1,p("Game archives not found — waiting for the player to point at their install.");return}for(const s of n.entries)$.mount(e,s);const a=n.entries.reduce((s,r)=>s+r.size,0);p(`Streaming ${n.entries.length} game archives (${(a/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(t=>{p(`Asset manifest failed: ${t.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const t=e.FS;t.mkdirTree(O),t.mount(e.IDBFS,{},O),t.syncfs(!0,()=>{const n=`${O}/Options.ini`;let a=!0;try{t.stat(n)}catch{a=!1}if((!a||y.get("resetOptions")==="1")&&t.writeFile(n,ie),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",r=t.readFile(n,{encoding:"utf8"});t.writeFile(n,/^Resolution = /m.test(r)?r.replace(/^Resolution = .*$/m,s):`${r}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>t.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>t.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};Z.onRuntimeInitialized=function(){b=this,globalThis.__gx=this,C.dataset.ready="true";const e=sessionStorage.getItem("generalsX.lanClient"),t=Number(y.get("lanClient")??e??0)||de();sessionStorage.setItem("generalsX.lanClient",String(t));const n=N[t]??`Player${t}`,a=setInterval(()=>{b?.ccall?.("GeneralsXLanSetName","number",["string"],[n])&&clearInterval(a)},500);if(E("Running"),v(),_){const s=setInterval(()=>{b?._GeneralsXSetAudioMuted?.(1)&&clearInterval(s)},500)}};E("Loading…");const ue=(await K(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;ue(Z);
