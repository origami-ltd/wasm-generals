(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function n(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(s){if(s.ep)return;s.ep=!0;const r=n(s);fetch(s.href,r)}})();const Z="modulepreload",N=function(e){return"/"+e},D={},Y=function(t,n,a){let s=Promise.resolve();if(n&&n.length>0){let o=function(d){return Promise.all(d.map(h=>Promise.resolve(h).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),l=i?.nonce||i?.getAttribute("nonce");s=o(n.map(d=>{if(d=N(d),d in D)return;D[d]=!0;const h=d.endsWith(".css"),m=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${m}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":Z,h||(f.as="script"),f.crossOrigin="",f.href=d,l&&f.setAttribute("nonce",l),document.head.appendChild(f),h)return new Promise((C,b)=>{f.addEventListener("load",C),f.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${d}`)))})}))}function r(o){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=o,window.dispatchEvent(i),!i.defaultPrevented)throw o}return s.then(o=>{for(const i of o||[])i.status==="rejected"&&r(i.reason);return t().catch(r)})},g=4*1024*1024,K=192*1024*1024,V=`
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
  };`;class J{constructor(t){if(this.onError=t,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([V],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(g+8),this.ready=new Promise(n=>this.worker?.addEventListener("message",n,{once:!0}))}cache=new Map;worker=null;buffer=null;ready;fetchChunkSync(t,n,a){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const s=new Int32Array(this.buffer,0,2);Atomics.store(s,0,0);const r=n*g;this.worker.postMessage({url:a?"":new URL(t,location.href).href,handle:a,start:r,end:r+g-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(s,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${t} chunk ${n}`),new Uint8Array(0);return Atomics.load(s,0)!==1?(this.onError(`Archive fetch failed: ${t} chunk ${n}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(s[1]??0)))}takeChunk(t,n,a){const s=`${t}#${n}`,r=this.cache.get(s);if(r)return this.cache.delete(s),this.cache.set(s,r),r;const o=this.fetchChunkSync(t,n,a);this.cache.set(s,o);let i=0;for(const l of this.cache.values())i+=l.length;for(;i>K&&this.cache.size>1;){const l=this.cache.keys().next().value;i-=this.cache.get(l)?.length??0,this.cache.delete(l)}return o}mount(t,n){const a=t.FS;a.mkdirTree(n.mount);const s=a.createFile(n.mount,n.name,{},!0,!1),r=n.size;Object.defineProperty(s,"usedBytes",{get:()=>r}),s.stream_ops={llseek:(o,i,l)=>{let d=i;if(l===1?d+=o.position:l===2&&(d=r+i),d<0)throw new a.ErrnoError(28);return d},read:(o,i,l,d,h)=>{const m=Math.min(r,h+d);if(h>=m)return 0;const f=Math.floor(h/g),C=Math.floor((m-1)/g);let b=0;for(let v=f;v<=C;v+=1){const X=this.takeChunk(n.url,v,n.handle),S=v*g,M=Math.max(h,S)-S,P=Math.min(m,S+X.length)-S;if(P<=M)break;i.set(X.subarray(M,P),l+b),b+=P-M}return b}}}}async function Q(){return await(await fetch("/GeneralsXAssets")).json()}async function ee(e,t=3){const n=new Map,a=async(s,r)=>{let o=!1,i=!1;const l=[];for await(const[d,h]of s.entries())h.kind==="directory"?l.push(h):d.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(d)?o=!0:i=!0);if(o&&!n.has("GeneralsZH")?n.set("GeneralsZH",s):i&&!o&&!n.has("Generals")&&n.set("Generals",s),!(n.size===2||r>=t)){for(const d of l)if(await a(d,r+1),n.size===2)return}};return await a(e,0),n}async function te(){const t=(await new Promise((s,r)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>s(o.result),o.onerror=()=>r(o.error)})).transaction("handles","readonly").objectStore("handles"),n=s=>new Promise(r=>{const o=t.get(s);o.onsuccess=()=>r(o.result),o.onerror=()=>r(void 0)}),a=[];for(const s of["GeneralsZH","Generals"]){const r=await n(s);if(r){if(await r.queryPermission?.({mode:"read"})!=="granted"&&await r.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,i]of r.entries()){if(!o.toLowerCase().endsWith(".big")||i.kind!=="file")continue;const l=await i.getFile();a.push({mount:`/${s}`,name:o,url:`local:${s}/${o}`,size:l.size,handle:i})}}}return a}const se=`
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function ne(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
    <header class="flex min-h-[58px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hud-border bg-hud-surface px-3 py-2 shadow-[0_0_18px_hsl(188_100%_50%/.12)] sm:px-10">
      <div class="flex items-baseline gap-3">
        <h1 class="m-0 text-[clamp(18px,2.4vw,26px)] uppercase tracking-[0.14em] text-hud-accent [text-shadow:0_0_12px_hsl(188_100%_50%/.55)]">GeneralsX</h1>
        <p class="m-0 hidden text-sm text-hud-muted sm:block">WebAssembly + WebGPU</p>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <span id="steam-chip" class="hidden border-l-[3px] border-hud-ready bg-hud-raised px-3 py-1.5 text-xs"></span>
        <button id="reset" class="hud-button" title="Clear saved settings and ownership, then reload">Reset</button>
        <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden sm:inline">Display</span>
          <select id="aspect" class="hud-select"><option value="16:9">16:9</option><option value="4:3">4:3</option></select>
        </label>
        <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden sm:inline">Boot</span>
          <select id="boot" class="hud-select">
            <option value="fast">Fast start</option>
            <option value="full">Full start</option>
          </select>
        </label>
        <button id="sound" class="hud-button">Sound on</button>
        <button id="fullscreen" class="hud-button">Fullscreen</button>
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
              <h2 class="m-0 mb-2 uppercase tracking-[0.12em] text-hud-accent [text-shadow:0_0_12px_hsl(188_100%_50%/.5)]">Prove you own the game</h2>
              <p class="mb-5 text-[13px] text-hud-muted">GeneralsX runs your own copy of
                 <strong>Command &amp; Conquer Generals — Zero Hour</strong>. Either one is enough:</p>
              <div class="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
                <div class="border border-hud-border bg-[hsl(210_100%_4%)] p-4">
                  <h3 class="m-0 mb-2 text-sm uppercase tracking-[0.08em] text-hud-accent">Sign in through Steam</h3>
                  <p class="text-[13px] text-hud-muted">Verifies ownership on your Steam account. Nothing is downloaded.</p>
                  <button id="firstrun-steam" class="hud-button mt-2">Sign in through Steam</button>
                  <p id="firstrun-steam-note" class="min-h-4 text-xs text-hud-warm"></p>
                </div>
                <div class="hidden items-center justify-center self-stretch text-xs uppercase tracking-widest text-hud-muted md:flex">or</div>
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
              </div>
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${se}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const c=e=>document.getElementById(e);ne(c("app"));const u=c("canvas"),E=c("frame"),I=c("stage"),G=c("output"),F=c("status"),x=c("cursor-overlay"),_=new URLSearchParams(location.search),R="/home/web_user/.local/share/GeneralsX/GeneralsZH",re=`Resolution = 1280 720
`,L=[],k=[];let T=Promise.resolve();function p(e){L.push(e),k.push(e),k.length>512&&k.shift(),G.value=`${k.join(`
`)}
`,G.scrollTop=G.scrollHeight}function j(e=!1){if(!L.length)return;const t=`${L.join(`
`)}
`;if(L.length=0,e){navigator.sendBeacon("/GeneralsXLog",t);return}T=T.then(()=>fetch("/GeneralsXLog",{method:"POST",body:t}).catch(()=>{}))}setInterval(()=>j(),2e3);addEventListener("pagehide",()=>j(!0));const O=e=>{F.textContent=e||F.textContent||""},W=(_.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",oe=_.get("sound")!=="0";let A=localStorage.getItem("generalsX.soundMuted")==="1";const q=W==="fast"?["-quickstart","-noshellmap"]:[];oe||q.push("-noaudio");c("boot").value=W;c("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const H=c("aspect");H.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";H.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",H.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});c("reset").addEventListener("click",()=>{localStorage.clear(),document.cookie="gxsteam=; Path=/; Max-Age=0",indexedDB.deleteDatabase("generalsx"),location.reload()});c("firstrun-steam").addEventListener("click",()=>{open("/GeneralsXSteamLogin","gx-steam","width=820,height=720"),addEventListener("message",e=>{e.data==="gx-steam-done"&&location.reload()},{once:!0})});c("firstrun-info").addEventListener("click",()=>{const e=c("firstrun-info-panel");e.hidden=!e.hidden});c("firstrun-folder").addEventListener("click",async()=>{const e=c("firstrun-folder-note"),t=window.showDirectoryPicker;if(!t){e.textContent="This browser cannot pick folders — use Chrome, or the Steam option.";return}try{const n=await t({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const a=await ee(n);if(!a.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const r=(await new Promise((o,i)=>{const l=indexedDB.open("generalsx",1);l.onupgradeneeded=()=>l.result.createObjectStore("handles"),l.onsuccess=()=>o(l.result),l.onerror=()=>i(l.error)})).transaction("handles","readwrite").objectStore("handles");for(const[o,i]of a)r.put(i,o);e.textContent=`Found ${[...a.keys()].join(" + ")}. Reloading…`,setTimeout(()=>location.reload(),700)}catch(n){console.debug("folder selection cancelled",n),e.textContent=""}});function w(){const e=document.fullscreenElement===E,t=Math.min(e?innerWidth:I.clientWidth,innerWidth)-16,n=Math.min(e?innerHeight:I.clientHeight,innerHeight)-16,a=Math.min(t/(u.width||1),n/(u.height||1));u.style.width=`${Math.max(1,Math.floor((u.width||1)*a))}px`,u.style.height=`${Math.max(1,Math.floor((u.height||1)*a))}px`}new ResizeObserver(w).observe(I);new MutationObserver(w).observe(u,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",w);document.addEventListener("fullscreenchange",w);c("fullscreen").addEventListener("click",()=>void E.requestFullscreen().catch(()=>{}));let U="";function B(){if(document.pointerLockElement!==u)return;const e=y?._GeneralsXMouseX?.()??-1,t=y?._GeneralsXMouseY?.()??-1,n=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(u.style.cursor);if(n&&e>=0&&t>=0){const[,a,s="0",r="0"]=n;a!==U&&(U=a,x.src=a);const o=u.getBoundingClientRect(),i=o.width/(u.width||1),l=o.height/(u.height||1);x.hidden=!1,x.style.transform=`translate(${o.left+e*i-Number(s)}px, ${o.top+t*l-Number(r)}px)`}else x.hidden=!0;requestAnimationFrame(B)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===u;u.classList.toggle("pointer-locked",e),e?B():x.hidden=!0});u.addEventListener("contextmenu",e=>e.preventDefault());u.addEventListener("pointerdown",()=>{u.focus(),!document.pointerLockElement&&E.dataset.ready==="true"&&u.requestPointerLock()});function ae(e){A=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),y?._GeneralsXSetAudioMuted?.(e?1:0),c("sound").textContent=e?"Sound off":"Sound on"}c("sound").addEventListener("click",()=>ae(!A));c("sound").textContent=A?"Sound off":"Sound on";const $=new J(p);let y;c("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";c("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const z={canvas:u,arguments:q,print:e=>p(e),printErr:e=>p(e),setStatus:O,preRun:[e=>{if(e.addRunDependency("gx-ownership"),_.get("assets")==="1"){c("firstrun").hidden=!1;return}fetch("/GeneralsXSteamSession").then(t=>t.json()).then(t=>{if(!t.gate||t.authenticated&&t.owns){if(t.gate){const n=c("steam-chip");n.textContent=`STEAM ✓ ${t.name}`.trim(),n.classList.remove("hidden")}e.removeRunDependency("gx-ownership");return}c("firstrun").hidden=!1,t.authenticated&&(c("firstrun-steam-note").textContent="Ownership not confirmed on this account.")}).catch(()=>e.removeRunDependency("gx-ownership"))},e=>{e.addRunDependency("gx-assets"),Promise.all([te(),$.ready]).then(async([t])=>{if(t.length){for(const s of t)$.mount(e,s);p(`Streaming ${t.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}const n=await Q();if(n.missing){c("firstrun").hidden=!1,p("Game archives not found — waiting for the player to point at their install.");return}for(const s of n.entries)$.mount(e,s);const a=n.entries.reduce((s,r)=>s+r.size,0);p(`Streaming ${n.entries.length} game archives (${(a/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(t=>{p(`Asset manifest failed: ${t.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const t=e.FS;t.mkdirTree(R),t.mount(e.IDBFS,{},R),t.syncfs(!0,()=>{const n=`${R}/Options.ini`;let a=!0;try{t.stat(n)}catch{a=!1}if((!a||_.get("resetOptions")==="1")&&t.writeFile(n,re),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",r=t.readFile(n,{encoding:"utf8"});t.writeFile(n,/^Resolution = /m.test(r)?r.replace(/^Resolution = .*$/m,s):`${r}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>t.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>t.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};z.onRuntimeInitialized=function(){if(y=this,globalThis.__gx=this,E.dataset.ready="true",O("Running"),w(),A){const e=setInterval(()=>{y?._GeneralsXSetAudioMuted?.(1)&&clearInterval(e)},500)}};O("Loading…");const ie=(await Y(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;ie(z);
