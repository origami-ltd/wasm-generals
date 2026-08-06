(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(n){if(n.ep)return;n.ep=!0;const r=t(n);fetch(n.href,r)}})();const z="modulepreload",N=function(e){return"/"+e},T={},Y=function(s,t,i){let n=Promise.resolve();if(t&&t.length>0){let a=function(d){return Promise.all(d.map(h=>Promise.resolve(h).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),l=o?.nonce||o?.getAttribute("nonce");n=a(t.map(d=>{if(d=N(d),d in T)return;T[d]=!0;const h=d.endsWith(".css"),m=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${m}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":z,h||(f.as="script"),f.crossOrigin="",f.href=d,l&&f.setAttribute("nonce",l),document.head.appendChild(f),h)return new Promise((A,b)=>{f.addEventListener("load",A),f.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${d}`)))})}))}function r(a){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=a,window.dispatchEvent(o),!o.defaultPrevented)throw a}return n.then(a=>{for(const o of a||[])o.status==="rejected"&&r(o.reason);return s().catch(r)})},g=4*1024*1024,K=192*1024*1024,V=`
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
  };`;class J{constructor(s){if(this.onError=s,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([V],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(g+8),this.ready=new Promise(t=>this.worker?.addEventListener("message",t,{once:!0}))}cache=new Map;worker=null;buffer=null;ready;fetchChunkSync(s,t,i){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const n=new Int32Array(this.buffer,0,2);Atomics.store(n,0,0);const r=t*g;this.worker.postMessage({url:i?"":new URL(s,location.href).href,handle:i,start:r,end:r+g-1,sab:this.buffer});const a=Date.now()+6e4;for(;Atomics.load(n,0)===0;)if(Date.now()>a)return this.onError(`Archive fetch timed out: ${s} chunk ${t}`),new Uint8Array(0);return Atomics.load(n,0)!==1?(this.onError(`Archive fetch failed: ${s} chunk ${t}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(n[1]??0)))}takeChunk(s,t,i){const n=`${s}#${t}`,r=this.cache.get(n);if(r)return this.cache.delete(n),this.cache.set(n,r),r;const a=this.fetchChunkSync(s,t,i);this.cache.set(n,a);let o=0;for(const l of this.cache.values())o+=l.length;for(;o>K&&this.cache.size>1;){const l=this.cache.keys().next().value;o-=this.cache.get(l)?.length??0,this.cache.delete(l)}return a}mount(s,t){const i=s.FS;i.mkdirTree(t.mount);const n=i.createFile(t.mount,t.name,{},!0,!1),r=t.size;Object.defineProperty(n,"usedBytes",{get:()=>r}),n.stream_ops={llseek:(a,o,l)=>{let d=o;if(l===1?d+=a.position:l===2&&(d=r+o),d<0)throw new i.ErrnoError(28);return d},read:(a,o,l,d,h)=>{const m=Math.min(r,h+d);if(h>=m)return 0;const f=Math.floor(h/g),A=Math.floor((m-1)/g);let b=0;for(let v=f;v<=A;v+=1){const F=this.takeChunk(t.url,v,t.handle),S=v*g,M=Math.max(h,S)-S,P=Math.min(m,S+F.length)-S;if(P<=M)break;o.set(F.subarray(M,P),l+b),b+=P-M}return b}}}}async function Q(){return await(await fetch("/GeneralsXAssets")).json()}async function ee(e,s=3){const t=new Map,i=async(n,r)=>{let a=!1,o=!1;const l=[];for await(const[d,h]of n.entries())h.kind==="directory"?l.push(h):d.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(d)?a=!0:o=!0);if(a&&!t.has("GeneralsZH")?t.set("GeneralsZH",n):o&&!a&&!t.has("Generals")&&t.set("Generals",n),!(t.size===2||r>=s)){for(const d of l)if(await i(d,r+1),t.size===2)return}};return await i(e,0),t}async function te(){try{return await se()}catch(e){return console.debug("local archives unavailable",e),[]}}async function se(){const s=(await new Promise((r,a)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>r(o.result),o.onerror=()=>a(o.error)})).transaction("handles","readonly").objectStore("handles"),t=r=>new Promise(a=>{const o=s.get(r);o.onsuccess=()=>a(o.result),o.onerror=()=>a(void 0)}),i={GeneralsZH:t("GeneralsZH"),Generals:t("Generals")},n=[];for(const r of["GeneralsZH","Generals"]){const a=await i[r];if(a){if(await a.queryPermission?.({mode:"read"})!=="granted"&&await a.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,l]of a.entries()){if(!o.toLowerCase().endsWith(".big")||l.kind!=="file")continue;const d=await l.getFile();n.push({mount:`/${r}`,name:o,url:`local:${r}/${o}`,size:d.size,handle:l})}}}return n}async function ne(){try{const e=await new Promise((s,t)=>{const i=indexedDB.open("generalsx",1);i.onupgradeneeded=()=>i.result.createObjectStore("handles"),i.onsuccess=()=>s(i.result),i.onerror=()=>t(i.error)});return await new Promise(s=>{const t=e.transaction("handles","readonly").objectStore("handles").count();t.onsuccess=()=>s(t.result>0),t.onerror=()=>s(!1)})}catch{return!1}}const re=`
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
                <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden sm:inline">Display</span>
            <select id="aspect" class="hud-select"><option value="16:9">16:9</option><option value="4:3">4:3</option></select>
          </label>
          <label class="flex items-center gap-2 text-sm text-hud-muted"><span class="hidden sm:inline">Boot</span>
            <select id="boot" class="hud-select">
              <option value="fast">Fast start</option>
              <option value="full">Full start</option>
            </select>
          </label>
        </div>
        <div class="flex items-center gap-2">
          <button id="share" class="hud-button" title="Copy the link for players on your network">Multiplayer</button>
          <button id="sound" class="hud-button">Sound on</button>
          <button id="fullscreen" class="hud-button">Fullscreen</button>
          <button id="reset" class="hud-button" title="Clear saved settings and ownership, then reload">Reset</button>
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
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${re}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const c=e=>document.getElementById(e);oe(c("app"));const u=c("canvas"),C=c("frame"),H=c("stage"),G=c("output"),X=c("status"),x=c("cursor-overlay"),E=new URLSearchParams(location.search),$="/home/web_user/.local/share/GeneralsX/GeneralsZH",ae=`Resolution = 1280 720
`,L=[],k=[];let D=Promise.resolve();function p(e){L.push(e),k.push(e),k.length>512&&k.shift(),G.value=`${k.join(`
`)}
`,G.scrollTop=G.scrollHeight}function j(e=!1){if(!L.length)return;const s=`${L.join(`
`)}
`;if(L.length=0,e){navigator.sendBeacon("/GeneralsXLog",s);return}D=D.then(()=>fetch("/GeneralsXLog",{method:"POST",body:s}).catch(()=>{}))}setInterval(()=>j(),2e3);addEventListener("pagehide",()=>j(!0));const O=e=>{X.textContent=e||X.textContent||""},q=(E.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",ie=E.get("sound")!=="0";let _=localStorage.getItem("generalsX.soundMuted")==="1";const B=q==="fast"?["-quickstart","-noshellmap"]:[];ie||B.push("-noaudio");c("boot").value=q;c("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const R=c("aspect");R.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";R.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",R.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});c("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});c("share").addEventListener("click",async()=>{const e=c("share"),{url:s}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(s).catch(()=>{});const t=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=t},1800)});c("firstrun-info").addEventListener("click",()=>{const e=c("firstrun-info-panel");e.hidden=!e.hidden});c("firstrun-folder").addEventListener("click",async()=>{const e=c("firstrun-folder-note"),s=window.showDirectoryPicker;if(!s){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const t=await s({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const i=await ee(t);if(!i.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const r=(await new Promise((a,o)=>{const l=indexedDB.open("generalsx",1);l.onupgradeneeded=()=>l.result.createObjectStore("handles"),l.onsuccess=()=>a(l.result),l.onerror=()=>o(l.error)})).transaction("handles","readwrite").objectStore("handles");for(const[a,o]of i)r.put(o,a);e.textContent=`Found ${[...i.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(t){console.debug("folder selection cancelled",t),e.textContent=""}});function w(){const e=document.fullscreenElement===C,s=Math.min(e?innerWidth:H.clientWidth,innerWidth)-16,t=Math.min(e?innerHeight:H.clientHeight,innerHeight)-16,i=Math.min(s/(u.width||1),t/(u.height||1));u.style.width=`${Math.max(1,Math.floor((u.width||1)*i))}px`,u.style.height=`${Math.max(1,Math.floor((u.height||1)*i))}px`}new ResizeObserver(w).observe(H);new MutationObserver(w).observe(u,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",w);document.addEventListener("fullscreenchange",w);c("fullscreen").addEventListener("click",()=>void C.requestFullscreen().catch(()=>{}));let U="";function W(){if(document.pointerLockElement!==u)return;const e=y?._GeneralsXMouseX?.()??-1,s=y?._GeneralsXMouseY?.()??-1,t=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(u.style.cursor);if(t&&e>=0&&s>=0){const[,i,n="0",r="0"]=t;i!==U&&(U=i,x.src=i);const a=u.getBoundingClientRect(),o=a.width/(u.width||1),l=a.height/(u.height||1);x.hidden=!1,x.style.transform=`translate(${a.left+e*o-Number(n)}px, ${a.top+s*l-Number(r)}px)`}else x.hidden=!0;requestAnimationFrame(W)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===u;u.classList.toggle("pointer-locked",e),e?W():x.hidden=!0});u.addEventListener("contextmenu",e=>e.preventDefault());u.addEventListener("pointerdown",()=>{u.focus(),!document.pointerLockElement&&C.dataset.ready==="true"&&u.requestPointerLock()});function le(e){_=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),y?._GeneralsXSetAudioMuted?.(e?1:0),c("sound").textContent=e?"Sound off":"Sound on"}c("sound").addEventListener("click",()=>le(!_));c("sound").textContent=_?"Sound off":"Sound on";const I=new J(p);let y;c("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";c("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const Z={canvas:u,arguments:B,print:e=>p(e),printErr:e=>p(e),setStatus:O,preRun:[e=>{if(e.addRunDependency("gx-assets"),E.get("assets")==="1"){c("firstrun").hidden=!1;return}Promise.all([te(),I.ready]).then(async([s])=>{if(s.length){for(const n of s)I.mount(e,n);p(`Streaming ${s.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await ne()){c("firstrun").hidden=!1,c("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const t=await Q();if(t.missing){c("firstrun").hidden=!1,p("Game archives not found — waiting for the player to point at their install.");return}for(const n of t.entries)I.mount(e,n);const i=t.entries.reduce((n,r)=>n+r.size,0);p(`Streaming ${t.entries.length} game archives (${(i/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(s=>{p(`Asset manifest failed: ${s.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const s=e.FS;s.mkdirTree($),s.mount(e.IDBFS,{},$),s.syncfs(!0,()=>{const t=`${$}/Options.ini`;let i=!0;try{s.stat(t)}catch{i=!1}if((!i||E.get("resetOptions")==="1")&&s.writeFile(t,ae),localStorage.getItem("generalsX.aspectApply")==="1"){const n=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",r=s.readFile(t,{encoding:"utf8"});s.writeFile(t,/^Resolution = /m.test(r)?r.replace(/^Resolution = .*$/m,n):`${r}${n}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>s.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>s.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};Z.onRuntimeInitialized=function(){if(y=this,globalThis.__gx=this,C.dataset.ready="true",O("Running"),w(),_){const e=setInterval(()=>{y?._GeneralsXSetAudioMuted?.(1)&&clearInterval(e)},500)}};O("Loading…");const ce=(await Y(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;ce(Z);
