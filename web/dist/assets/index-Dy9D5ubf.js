(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function r(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function a(s){if(s.ep)return;s.ep=!0;const n=r(s);fetch(s.href,n)}})();const N="modulepreload",Z=function(e){return"/"+e},T={},Y=function(t,r,a){let s=Promise.resolve();if(r&&r.length>0){let o=function(u){return Promise.all(u.map(h=>Promise.resolve(h).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};document.getElementsByTagName("link");const c=document.querySelector("meta[property=csp-nonce]"),l=c?.nonce||c?.getAttribute("nonce");s=o(r.map(u=>{if(u=Z(u),u in T)return;T[u]=!0;const h=u.endsWith(".css"),f=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${u}"]${f}`))return;const m=document.createElement("link");if(m.rel=h?"stylesheet":N,h||(m.as="script"),m.crossOrigin="",m.href=u,l&&m.setAttribute("nonce",l),document.head.appendChild(m),h)return new Promise((C,x)=>{m.addEventListener("load",C),m.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${u}`)))})}))}function n(o){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=o,window.dispatchEvent(c),!c.defaultPrevented)throw o}return s.then(o=>{for(const c of o||[])c.status==="rejected"&&n(c.reason);return t().catch(n)})},g=4*1024*1024,K=192*1024*1024,V=`
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
  };`;class J{constructor(t){if(this.onError=t,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([V],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(g+8),this.ready=new Promise(r=>this.worker?.addEventListener("message",r,{once:!0}))}cache=new Map;worker=null;buffer=null;ready;fetchChunkSync(t,r,a){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const s=new Int32Array(this.buffer,0,2);Atomics.store(s,0,0);const n=r*g;this.worker.postMessage({url:a?"":new URL(t,location.href).href,handle:a,start:n,end:n+g-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(s,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${t} chunk ${r}`),new Uint8Array(0);return Atomics.load(s,0)!==1?(this.onError(`Archive fetch failed: ${t} chunk ${r}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(s[1]??0)))}takeChunk(t,r,a){const s=`${t}#${r}`,n=this.cache.get(s);if(n)return this.cache.delete(s),this.cache.set(s,n),n;const o=this.fetchChunkSync(t,r,a);this.cache.set(s,o);let c=0;for(const l of this.cache.values())c+=l.length;for(;c>K&&this.cache.size>1;){const l=this.cache.keys().next().value;c-=this.cache.get(l)?.length??0,this.cache.delete(l)}return o}mount(t,r){const a=t.FS;a.mkdirTree(r.mount);const s=a.createFile(r.mount,r.name,{},!0,!1),n=r.size;Object.defineProperty(s,"usedBytes",{get:()=>n}),s.stream_ops={llseek:(o,c,l)=>{let u=c;if(l===1?u+=o.position:l===2&&(u=n+c),u<0)throw new a.ErrnoError(28);return u},read:(o,c,l,u,h)=>{const f=Math.min(n,h+u);if(h>=f)return 0;const m=Math.floor(h/g),C=Math.floor((f-1)/g);let x=0;for(let w=m;w<=C;w+=1){const F=this.takeChunk(r.url,w,r.handle),S=w*g,M=Math.max(h,S)-S,P=Math.min(f,S+F.length)-S;if(P<=M)break;c.set(F.subarray(M,P),l+x),x+=P-M}return x}}}}async function Q(){return await(await fetch("/GeneralsXAssets")).json()}async function ee(){const t=(await new Promise((s,n)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>s(o.result),o.onerror=()=>n(o.error)})).transaction("handles","readonly").objectStore("handles"),r=s=>new Promise(n=>{const o=t.get(s);o.onsuccess=()=>n(o.result),o.onerror=()=>n(void 0)}),a=[];for(const s of["GeneralsZH","Generals"]){const n=await r(s);if(n){if(await n.queryPermission?.({mode:"read"})!=="granted"&&await n.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[o,c]of n.entries()){if(!o.toLowerCase().endsWith(".big")||c.kind!=="file")continue;const l=await c.getFile();a.push({mount:`/${s}`,name:o,url:`local:${s}/${o}`,size:l.size,handle:c})}}}return a}const te=`
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;function se(e){e.className="flex min-h-svh flex-col",e.innerHTML=`
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
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${te}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`}const i=e=>document.getElementById(e);se(i("app"));const d=i("canvas"),L=i("frame"),$=i("stage"),R=i("output"),D=i("status"),b=i("cursor-overlay"),E=new URLSearchParams(location.search),G="/home/web_user/.local/share/GeneralsX/GeneralsZH",ne=`Resolution = 1280 720
`,_=[],k=[];let H=Promise.resolve();function p(e){_.push(e),k.push(e),k.length>512&&k.shift(),R.value=`${k.join(`
`)}
`,R.scrollTop=R.scrollHeight}function j(e=!1){if(!_.length)return;const t=`${_.join(`
`)}
`;if(_.length=0,e){navigator.sendBeacon("/GeneralsXLog",t);return}H=H.then(()=>fetch("/GeneralsXLog",{method:"POST",body:t}).catch(()=>{}))}setInterval(()=>j(),2e3);addEventListener("pagehide",()=>j(!0));const X=e=>{D.textContent=e||D.textContent||""},q=(E.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",re=E.get("sound")!=="0";let A=localStorage.getItem("generalsX.soundMuted")==="1";const B=q==="fast"?["-quickstart","-noshellmap"]:[];re||B.push("-noaudio");i("boot").value=q;i("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const O=i("aspect");O.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";O.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",O.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});i("reset").addEventListener("click",()=>{localStorage.clear(),document.cookie="gxsteam=; Path=/; Max-Age=0",indexedDB.deleteDatabase("generalsx"),location.reload()});i("firstrun-steam").addEventListener("click",()=>{open("/GeneralsXSteamLogin","gx-steam","width=820,height=720"),addEventListener("message",e=>{e.data==="gx-steam-done"&&location.reload()},{once:!0})});i("firstrun-info").addEventListener("click",()=>{const e=i("firstrun-info-panel");e.hidden=!e.hidden});i("firstrun-folder").addEventListener("click",async()=>{const e=i("firstrun-folder-note"),t=window.showDirectoryPicker;if(!t){e.textContent="This browser cannot pick folders — use Chrome, or the Steam option.";return}try{const r=await t({id:"generalsx-zerohour",mode:"read"});e.textContent="Now select the base Generals folder…";const a=await t({id:"generalsx-generals",mode:"read"}),n=(await new Promise((o,c)=>{const l=indexedDB.open("generalsx",1);l.onupgradeneeded=()=>l.result.createObjectStore("handles"),l.onsuccess=()=>o(l.result),l.onerror=()=>c(l.error)})).transaction("handles","readwrite").objectStore("handles");n.put(r,"GeneralsZH"),n.put(a,"Generals"),e.textContent="Folders saved. Reloading…",setTimeout(()=>location.reload(),600)}catch(r){console.debug("folder selection cancelled",r),e.textContent=""}});function v(){const e=document.fullscreenElement===L,t=Math.min(e?innerWidth:$.clientWidth,innerWidth)-16,r=Math.min(e?innerHeight:$.clientHeight,innerHeight)-16,a=Math.min(t/(d.width||1),r/(d.height||1));d.style.width=`${Math.max(1,Math.floor((d.width||1)*a))}px`,d.style.height=`${Math.max(1,Math.floor((d.height||1)*a))}px`}new ResizeObserver(v).observe($);new MutationObserver(v).observe(d,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",v);document.addEventListener("fullscreenchange",v);i("fullscreen").addEventListener("click",()=>void L.requestFullscreen().catch(()=>{}));let U="";function W(){if(document.pointerLockElement!==d)return;const e=y?._GeneralsXMouseX?.()??-1,t=y?._GeneralsXMouseY?.()??-1,r=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(d.style.cursor);if(r&&e>=0&&t>=0){const[,a,s="0",n="0"]=r;a!==U&&(U=a,b.src=a);const o=d.getBoundingClientRect(),c=o.width/(d.width||1),l=o.height/(d.height||1);b.hidden=!1,b.style.transform=`translate(${o.left+e*c-Number(s)}px, ${o.top+t*l-Number(n)}px)`}else b.hidden=!0;requestAnimationFrame(W)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===d;d.classList.toggle("pointer-locked",e),e?W():b.hidden=!0});d.addEventListener("contextmenu",e=>e.preventDefault());d.addEventListener("pointerdown",()=>{d.focus(),!document.pointerLockElement&&L.dataset.ready==="true"&&d.requestPointerLock()});function oe(e){A=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),y?._GeneralsXSetAudioMuted?.(e?1:0),i("sound").textContent=e?"Sound off":"Sound on"}i("sound").addEventListener("click",()=>oe(!A));i("sound").textContent=A?"Sound off":"Sound on";const I=new J(p);let y;i("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";i("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const z={canvas:d,arguments:B,print:e=>p(e),printErr:e=>p(e),setStatus:X,preRun:[e=>{if(e.addRunDependency("gx-ownership"),E.get("assets")==="1"){i("firstrun").hidden=!1;return}fetch("/GeneralsXSteamSession").then(t=>t.json()).then(t=>{if(!t.gate||t.authenticated&&t.owns){if(t.gate){const r=i("steam-chip");r.textContent=`STEAM ✓ ${t.name}`.trim(),r.classList.remove("hidden")}e.removeRunDependency("gx-ownership");return}i("firstrun").hidden=!1,t.authenticated&&(i("firstrun-steam-note").textContent="Ownership not confirmed on this account.")}).catch(()=>e.removeRunDependency("gx-ownership"))},e=>{e.addRunDependency("gx-assets"),Promise.all([ee(),I.ready]).then(async([t])=>{if(t.length){for(const s of t)I.mount(e,s);p(`Streaming ${t.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}const r=await Q();if(r.missing){i("firstrun").hidden=!1,p("Game archives not found — waiting for the player to point at their install.");return}for(const s of r.entries)I.mount(e,s);const a=r.entries.reduce((s,n)=>s+n.size,0);p(`Streaming ${r.entries.length} game archives (${(a/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(t=>{p(`Asset manifest failed: ${t.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const t=e.FS;t.mkdirTree(G),t.mount(e.IDBFS,{},G),t.syncfs(!0,()=>{const r=`${G}/Options.ini`;let a=!0;try{t.stat(r)}catch{a=!1}if((!a||E.get("resetOptions")==="1")&&t.writeFile(r,ne),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",n=t.readFile(r,{encoding:"utf8"});t.writeFile(r,/^Resolution = /m.test(n)?n.replace(/^Resolution = .*$/m,s):`${n}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>t.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>t.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};z.onRuntimeInitialized=function(){if(y=this,globalThis.__gx=this,L.dataset.ready="true",X("Running"),v(),A){const e=setInterval(()=>{y?._GeneralsXSetAudioMuted?.(1)&&clearInterval(e)},500)}};X("Loading…");const ae=(await Y(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;ae(z);
