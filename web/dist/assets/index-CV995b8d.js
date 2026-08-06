(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function s(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(n){if(n.ep)return;n.ep=!0;const o=s(n);fetch(n.href,o)}})();const z="modulepreload",Z=function(e){return"/"+e},T={},Y=function(t,s,r){let n=Promise.resolve();if(s&&s.length>0){let i=function(d){return Promise.all(d.map(h=>Promise.resolve(h).then(p=>({status:"fulfilled",value:p}),p=>({status:"rejected",reason:p}))))};document.getElementsByTagName("link");const c=document.querySelector("meta[property=csp-nonce]"),u=c?.nonce||c?.getAttribute("nonce");n=i(s.map(d=>{if(d=Z(d),d in T)return;T[d]=!0;const h=d.endsWith(".css"),p=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${p}`))return;const m=document.createElement("link");if(m.rel=h?"stylesheet":z,h||(m.as="script"),m.crossOrigin="",m.href=d,u&&m.setAttribute("nonce",u),document.head.appendChild(m),h)return new Promise((C,x)=>{m.addEventListener("load",C),m.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${d}`)))})}))}function o(i){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=i,window.dispatchEvent(c),!c.defaultPrevented)throw i}return n.then(i=>{for(const c of i||[])c.status==="rejected"&&o(c.reason);return t().catch(o)})},f=4*1024*1024,K=192*1024*1024,V=`
  postMessage("ready");
  onmessage = async (event) => {
    const { url, start, end, sab } = event.data;
    const state = new Int32Array(sab, 0, 2);
    const data = new Uint8Array(sab, 8);
    try {
      const response = await fetch(url, { headers: { Range: "bytes=" + start + "-" + end } });
      if (!response.ok && response.status !== 206) throw new Error("HTTP " + response.status);
      const bytes = new Uint8Array(await response.arrayBuffer());
      data.set(bytes.subarray(0, data.length));
      state[1] = Math.min(bytes.length, data.length);
      Atomics.store(state, 0, 1);
    } catch {
      state[1] = 0;
      Atomics.store(state, 0, 2);
    }
  };`;class J{constructor(t){if(this.onError=t,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([V],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(f+8),this.ready=new Promise(s=>this.worker?.addEventListener("message",s,{once:!0}))}cache=new Map;worker=null;buffer=null;ready;fetchChunkSync(t,s){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const r=new Int32Array(this.buffer,0,2);Atomics.store(r,0,0);const n=s*f;this.worker.postMessage({url:new URL(t,location.href).href,start:n,end:n+f-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(r,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${t} chunk ${s}`),new Uint8Array(0);return Atomics.load(r,0)!==1?(this.onError(`Archive fetch failed: ${t} chunk ${s}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(r[1]??0)))}takeChunk(t,s){const r=`${t}#${s}`,n=this.cache.get(r);if(n)return this.cache.delete(r),this.cache.set(r,n),n;const o=this.fetchChunkSync(t,s);this.cache.set(r,o);let i=0;for(const c of this.cache.values())i+=c.length;for(;i>K&&this.cache.size>1;){const c=this.cache.keys().next().value;i-=this.cache.get(c)?.length??0,this.cache.delete(c)}return o}mount(t,s){const r=t.FS;r.mkdirTree(s.mount);const n=r.createFile(s.mount,s.name,{},!0,!1),o=s.size;Object.defineProperty(n,"usedBytes",{get:()=>o}),n.stream_ops={llseek:(i,c,u)=>{let d=c;if(u===1?d+=i.position:u===2&&(d=o+c),d<0)throw new r.ErrnoError(28);return d},read:(i,c,u,d,h)=>{const p=Math.min(o,h+d);if(h>=p)return 0;const m=Math.floor(h/f),C=Math.floor((p-1)/f);let x=0;for(let w=m;w<=C;w+=1){const O=this.takeChunk(s.url,w),S=w*f,M=Math.max(h,S)-S,P=Math.min(p,S+O.length)-S;if(P<=M)break;c.set(O.subarray(M,P),u+x),x+=P-M}return x}}}}async function Q(){return await(await fetch("/GeneralsXAssets")).json()}const ee=`
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function te(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
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
                 <strong>Command &amp; Conquer Generals — Zero Hour</strong>. Choose one:</p>
              <div class="grid gap-4 md:grid-cols-2">
                <div class="border border-hud-border bg-[hsl(210_100%_4%)] p-4">
                  <h3 class="m-0 mb-2 text-sm uppercase tracking-[0.08em] text-hud-accent">1 · Sign in through Steam</h3>
                  <p class="text-[13px] text-hud-muted">Verifies ownership on your Steam account. Nothing is downloaded.</p>
                  <button id="firstrun-steam" class="hud-button mt-2">Sign in through Steam</button>
                  <p id="firstrun-steam-note" class="min-h-4 text-xs text-hud-warm"></p>
                </div>
                <div class="border border-hud-border bg-[hsl(210_100%_4%)] p-4">
                  <h3 class="m-0 mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.08em] text-hud-accent">
                    2 · Select your game folder
                    <button id="firstrun-info" aria-label="Where to find the game folder"
                            class="hud-button h-5 min-h-5 w-5 rounded-full px-0 text-xs [clip-path:none]">i</button>
                  </h3>
                  <p class="text-[13px] text-hud-muted">Point the browser at your installed copy. The files stay on your machine.</p>
                  <button id="firstrun-folder" class="hud-button mt-2">Select game folder</button>
                  <p id="firstrun-folder-note" class="min-h-4 text-xs text-hud-warm"></p>
                </div>
              </div>
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${ee}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const a=e=>document.getElementById(e);te(a("app"));const l=a("canvas"),_=a("frame"),I=a("stage"),R=a("output"),F=a("status"),b=a("cursor-overlay"),L=new URLSearchParams(location.search),G="/home/web_user/.local/share/GeneralsX/GeneralsZH",se=`Resolution = 1280 720
`,E=[],k=[];let H=Promise.resolve();function g(e){E.push(e),k.push(e),k.length>512&&k.shift(),R.value=`${k.join(`
`)}
`,R.scrollTop=R.scrollHeight}function W(e=!1){if(!E.length)return;const t=`${E.join(`
`)}
`;if(E.length=0,e){navigator.sendBeacon("/GeneralsXLog",t);return}H=H.then(()=>fetch("/GeneralsXLog",{method:"POST",body:t}).catch(()=>{}))}setInterval(()=>W(),2e3);addEventListener("pagehide",()=>W(!0));const X=e=>{F.textContent=e||F.textContent||""},j=(L.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",ne=L.get("sound")!=="0";let A=localStorage.getItem("generalsX.soundMuted")==="1";const B=j==="fast"?["-quickstart","-noshellmap"]:[];ne||B.push("-noaudio");a("boot").value=j;a("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const $=a("aspect");$.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";$.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",$.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});a("reset").addEventListener("click",()=>{localStorage.clear(),document.cookie="gxsteam=; Path=/; Max-Age=0",indexedDB.deleteDatabase("generalsx"),location.reload()});a("firstrun-steam").addEventListener("click",()=>{open("/GeneralsXSteamLogin","gx-steam","width=820,height=720"),addEventListener("message",e=>{e.data==="gx-steam-done"&&location.reload()},{once:!0})});a("firstrun-info").addEventListener("click",()=>{const e=a("firstrun-info-panel");e.hidden=!e.hidden});a("firstrun-folder").addEventListener("click",async()=>{const e=a("firstrun-folder-note"),t=window.showDirectoryPicker;if(!t){e.textContent="This browser cannot pick folders — use Chrome, or the Steam option.";return}try{const s=await t({id:"generalsx-zerohour",mode:"read"});e.textContent="Now select the base Generals folder…";const r=await t({id:"generalsx-generals",mode:"read"}),o=(await new Promise((i,c)=>{const u=indexedDB.open("generalsx",1);u.onupgradeneeded=()=>u.result.createObjectStore("handles"),u.onsuccess=()=>i(u.result),u.onerror=()=>c(u.error)})).transaction("handles","readwrite").objectStore("handles");o.put(s,"GeneralsZH"),o.put(r,"Generals"),e.textContent="Folders saved. Reloading…",setTimeout(()=>location.reload(),600)}catch(s){e.textContent=`Folder selection cancelled: ${s.message}`}});function y(){const e=document.fullscreenElement===_,t=Math.min(e?innerWidth:I.clientWidth,innerWidth)-16,s=Math.min(e?innerHeight:I.clientHeight,innerHeight)-16,r=Math.min(t/(l.width||1),s/(l.height||1));l.style.width=`${Math.max(1,Math.floor((l.width||1)*r))}px`,l.style.height=`${Math.max(1,Math.floor((l.height||1)*r))}px`}new ResizeObserver(y).observe(I);new MutationObserver(y).observe(l,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",y);document.addEventListener("fullscreenchange",y);a("fullscreen").addEventListener("click",()=>void _.requestFullscreen().catch(()=>{}));let D="";function N(){if(document.pointerLockElement!==l)return;const e=v?._GeneralsXMouseX?.()??-1,t=v?._GeneralsXMouseY?.()??-1,s=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(l.style.cursor);if(s&&e>=0&&t>=0){const[,r,n="0",o="0"]=s;r!==D&&(D=r,b.src=r);const i=l.getBoundingClientRect(),c=i.width/(l.width||1),u=i.height/(l.height||1);b.hidden=!1,b.style.transform=`translate(${i.left+e*c-Number(n)}px, ${i.top+t*u-Number(o)}px)`}else b.hidden=!0;requestAnimationFrame(N)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===l;l.classList.toggle("pointer-locked",e),e?N():b.hidden=!0});l.addEventListener("contextmenu",e=>e.preventDefault());l.addEventListener("pointerdown",()=>{l.focus(),!document.pointerLockElement&&_.dataset.ready==="true"&&l.requestPointerLock()});function re(e){A=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),v?._GeneralsXSetAudioMuted?.(e?1:0),a("sound").textContent=e?"Sound off":"Sound on"}a("sound").addEventListener("click",()=>re(!A));a("sound").textContent=A?"Sound off":"Sound on";const U=new J(g);let v;a("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";a("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const q={canvas:l,arguments:B,print:e=>g(e),printErr:e=>g(e),setStatus:X,preRun:[e=>{if(e.addRunDependency("gx-ownership"),L.get("assets")==="1"){a("firstrun").hidden=!1;return}fetch("/GeneralsXSteamSession").then(t=>t.json()).then(t=>{if(!t.gate||t.authenticated&&t.owns){if(t.gate){const s=a("steam-chip");s.textContent=`STEAM ✓ ${t.name}`.trim(),s.classList.remove("hidden")}e.removeRunDependency("gx-ownership");return}a("firstrun").hidden=!1,t.authenticated&&(a("firstrun-steam-note").textContent="Ownership not confirmed on this account.")}).catch(()=>e.removeRunDependency("gx-ownership"))},e=>{e.addRunDependency("gx-assets"),Promise.all([Q(),U.ready]).then(([t])=>{if(t.missing){a("firstrun").hidden=!1,g("Game archives not found — waiting for the player to point at their install.");return}for(const r of t.entries)U.mount(e,r);const s=t.entries.reduce((r,n)=>r+n.size,0);g(`Streaming ${t.entries.length} game archives (${(s/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(t=>{g(`Asset manifest failed: ${t.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const t=e.FS;t.mkdirTree(G),t.mount(e.IDBFS,{},G),t.syncfs(!0,()=>{const s=`${G}/Options.ini`;let r=!0;try{t.stat(s)}catch{r=!1}if((!r||L.get("resetOptions")==="1")&&t.writeFile(s,se),localStorage.getItem("generalsX.aspectApply")==="1"){const n=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",o=t.readFile(s,{encoding:"utf8"});t.writeFile(s,/^Resolution = /m.test(o)?o.replace(/^Resolution = .*$/m,n):`${o}${n}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>t.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>t.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};q.onRuntimeInitialized=function(){if(v=this,globalThis.__gx=this,_.dataset.ready="true",X("Running"),y(),A){const e=setInterval(()=>{v?._GeneralsXSetAudioMuted?.(1)&&clearInterval(e)},500)}};X("Loading…");const oe=(await Y(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;oe(q);
