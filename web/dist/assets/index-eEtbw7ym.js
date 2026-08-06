(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(s){if(s.ep)return;s.ep=!0;const a=t(s);fetch(s.href,a)}})();const z="modulepreload",Y=function(e){return"/"+e},H={},K=function(n,t,r){let s=Promise.resolve();if(t&&t.length>0){let o=function(c){return Promise.all(c.map(h=>Promise.resolve(h).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),d=i?.nonce||i?.getAttribute("nonce");s=o(t.map(c=>{if(c=Y(c),c in H)return;H[c]=!0;const h=c.endsWith(".css"),m=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${m}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":z,h||(f.as="script"),f.crossOrigin="",f.href=c,d&&f.setAttribute("nonce",d),document.head.appendChild(f),h)return new Promise((P,w)=>{f.addEventListener("load",P),f.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${c}`)))})}))}function a(o){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=o,window.dispatchEvent(i),!i.defaultPrevented)throw o}return s.then(o=>{for(const i of o||[])i.status==="rejected"&&a(i.reason);return n().catch(a)})},g=256*1024,V=384*1024*1024,J=`
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
  };`;class Q{constructor(n){if(this.onError=n,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([J],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(g+8),this.ready=new Promise(t=>this.worker?.addEventListener("message",t,{once:!0}))}cache=new Map;cached=0;worker=null;buffer=null;ready;fetchChunkSync(n,t,r){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const s=new Int32Array(this.buffer,0,2);Atomics.store(s,0,0);const a=t*g;this.worker.postMessage({url:r?"":new URL(n,location.href).href,handle:r,start:a,end:a+g-1,sab:this.buffer});const o=Date.now()+6e4;for(;Atomics.load(s,0)===0;)if(Date.now()>o)return this.onError(`Archive fetch timed out: ${n} chunk ${t}`),new Uint8Array(0);return Atomics.load(s,0)!==1?(this.onError(`Archive fetch failed: ${n} chunk ${t}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(s[1]??0)))}takeChunk(n,t,r){const s=`${n}#${t}`,a=this.cache.get(s);if(a)return this.cache.delete(s),this.cache.set(s,a),a;const o=this.fetchChunkSync(n,t,r);for(this.cache.set(s,o),this.cached+=o.length;this.cached>V&&this.cache.size>1;){const i=this.cache.keys().next().value;this.cached-=this.cache.get(i)?.length??0,this.cache.delete(i)}return o}mount(n,t){const r=n.FS;r.mkdirTree(t.mount);const s=r.createFile(t.mount,t.name,{},!0,!1),a=t.size;Object.defineProperty(s,"usedBytes",{get:()=>a}),s.stream_ops={llseek:(o,i,d)=>{let c=i;if(d===1?c+=o.position:d===2&&(c=a+i),c<0)throw new r.ErrnoError(28);return c},read:(o,i,d,c,h)=>{const m=Math.min(a,h+c);if(h>=m)return 0;const f=Math.floor(h/g),P=Math.floor((m-1)/g);let w=0;for(let k=f;k<=P;k+=1){const F=this.takeChunk(t.url,k,t.handle),L=k*g,I=Math.max(h,L)-L,G=Math.min(m,L+F.length)-L;if(G<=I)break;i.set(F.subarray(I,G),d+w),w+=G-I}return w}}}}async function ee(){return await(await fetch("/GeneralsXAssets")).json()}async function te(e,n=3){const t=new Map,r=async(s,a)=>{let o=!1,i=!1;const d=[];for await(const[c,h]of s.entries())h.kind==="directory"?d.push(h):c.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(c)?o=!0:i=!0);if(o&&!t.has("GeneralsZH")?t.set("GeneralsZH",s):i&&!o&&!t.has("Generals")&&t.set("Generals",s),!(t.size===2||a>=n)){for(const c of d)if(await r(c,a+1),t.size===2)return}};return await r(e,0),t}async function ne(){try{return await se()}catch(e){return console.debug("local archives unavailable",e),[]}}async function se(){const n=(await new Promise((a,o)=>{const i=indexedDB.open("generalsx",1);i.onupgradeneeded=()=>i.result.createObjectStore("handles"),i.onsuccess=()=>a(i.result),i.onerror=()=>o(i.error)})).transaction("handles","readonly").objectStore("handles"),t=a=>new Promise(o=>{const i=n.get(a);i.onsuccess=()=>o(i.result),i.onerror=()=>o(void 0)}),r={GeneralsZH:t("GeneralsZH"),Generals:t("Generals")},s=[];for(const a of["GeneralsZH","Generals"]){const o=await r[a];if(o){if(await o.queryPermission?.({mode:"read"})!=="granted"&&await o.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[i,d]of o.entries()){if(!i.toLowerCase().endsWith(".big")||d.kind!=="file")continue;const c=await d.getFile();s.push({mount:`/${a}`,name:i,url:`local:${a}/${i}`,size:c.size,handle:d})}}}return s}async function re(){try{const e=await new Promise((n,t)=>{const r=indexedDB.open("generalsx",1);r.onupgradeneeded=()=>r.result.createObjectStore("handles"),r.onsuccess=()=>n(r.result),r.onerror=()=>t(r.error)});return await new Promise(n=>{const t=e.transaction("handles","readonly").objectStore("handles").count();t.onsuccess=()=>n(t.result>0),t.onerror=()=>n(!1)})}catch{return!1}}const ae=`
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
    </main>`}const l=e=>document.getElementById(e);oe(l("app"));const u=l("canvas"),E=l("frame"),R=l("stage"),O=l("output"),U=l("status"),x=l("cursor-overlay"),v=new URLSearchParams(location.search),X="/home/web_user/.local/share/GeneralsX/GeneralsZH",ie=`Resolution = 1280 720
`,C=[],A=[];let j=Promise.resolve();function p(e){C.push(e),A.push(e),A.length>512&&A.shift(),O.value=`${A.join(`
`)}
`,O.scrollTop=O.scrollHeight}function W(e=!1){if(!C.length)return;const n=`${C.join(`
`)}
`;if(C.length=0,e){navigator.sendBeacon("/GeneralsXLog",n);return}j=j.then(()=>fetch("/GeneralsXLog",{method:"POST",body:n}).catch(()=>{}))}setInterval(()=>W(),2e3);addEventListener("pagehide",()=>W(!0));const _=e=>{U.textContent=e||U.textContent||""},N=(v.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",le=v.get("sound")!=="0";let M=localStorage.getItem("generalsX.soundMuted")==="1";const q=N==="fast"?["-quickstart","-noshellmap"]:[];le||q.push("-noaudio");l("boot").value=N;l("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const T=l("aspect");T.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";T.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",T.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});l("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});l("share").addEventListener("click",async()=>{const e=l("share"),{url:n}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(n).catch(()=>{});const t=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=t},1800)});l("firstrun-info").addEventListener("click",()=>{const e=l("firstrun-info-panel");e.hidden=!e.hidden});l("firstrun-folder").addEventListener("click",async()=>{const e=l("firstrun-folder-note"),n=window.showDirectoryPicker;if(!n){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const t=await n({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const r=await te(t);if(!r.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const a=(await new Promise((o,i)=>{const d=indexedDB.open("generalsx",1);d.onupgradeneeded=()=>d.result.createObjectStore("handles"),d.onsuccess=()=>o(d.result),d.onerror=()=>i(d.error)})).transaction("handles","readwrite").objectStore("handles");for(const[o,i]of r)a.put(i,o);e.textContent=`Found ${[...r.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(t){console.debug("folder selection cancelled",t),e.textContent=""}});function S(){const e=document.fullscreenElement===E,n=Math.min(e?innerWidth:R.clientWidth,innerWidth)-16,t=Math.min(e?innerHeight:R.clientHeight,innerHeight)-16,r=Math.min(n/(u.width||1),t/(u.height||1));u.style.width=`${Math.max(1,Math.floor((u.width||1)*r))}px`,u.style.height=`${Math.max(1,Math.floor((u.height||1)*r))}px`}new ResizeObserver(S).observe(R);new MutationObserver(S).observe(u,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",S);document.addEventListener("fullscreenchange",S);l("fullscreen").addEventListener("click",()=>void E.requestFullscreen().catch(()=>{}));let D="";function B(){if(document.pointerLockElement!==u)return;const e=b?._GeneralsXMouseX?.()??-1,n=b?._GeneralsXMouseY?.()??-1,t=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(u.style.cursor);if(t&&e>=0&&n>=0){const[,r,s="0",a="0"]=t;r!==D&&(D=r,x.src=r);const o=u.getBoundingClientRect(),i=o.width/(u.width||1),d=o.height/(u.height||1);x.hidden=!1,x.style.transform=`translate(${o.left+e*i-Number(s)}px, ${o.top+n*d-Number(a)}px)`}else x.hidden=!0;requestAnimationFrame(B)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===u;u.classList.toggle("pointer-locked",e),e?B():x.hidden=!0});u.addEventListener("contextmenu",e=>e.preventDefault());u.addEventListener("pointerdown",()=>{u.focus(),!document.pointerLockElement&&E.dataset.ready==="true"&&u.requestPointerLock()});function ce(e){M=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),b?._GeneralsXSetAudioMuted?.(e?1:0),l("sound").textContent=e?"Sound off":"Sound on"}l("sound").addEventListener("click",()=>ce(!M));l("sound").textContent=M?"Sound off":"Sound on";crossOriginIsolated||_("Open this page over https:// — the browser blocks shared memory otherwise.");const y=["","emscripten","wasm","Reporting","YesSir","MoveOut","Affirmative","Rockets","OnTheWay","TargetSighted","ForTheMotherland","DeathFromAbove","AtOnce","IObey","ChinaWillGrow","GLAWillPrevail","USAWillProtect","AwaitingOrders","InPosition","TakingFire","ChargeTheAttack","ScudLaunch","AirForceOne","Overlord","Toxin"];function de(){let e=Number(localStorage.getItem("generalsX.lanOffset"));e||(e=Math.floor(Math.random()*(y.length-1))+1,localStorage.setItem("generalsX.lanOffset",String(e)));const n=new Set((localStorage.getItem("generalsX.lanUsed")??"").split(",").filter(Boolean).map(Number));for(let t=0;t<y.length-1;t+=1){const r=(e-1+t)%(y.length-1)+1;if(!n.has(r))return n.add(r),localStorage.setItem("generalsX.lanUsed",[...n].join(",")),r}return Math.floor(Math.random()*(y.length-1))+1}const $=new Q(p);let b;l("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";l("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const Z={canvas:u,arguments:q,print:e=>p(e),printErr:e=>p(e),setStatus:_,preRun:[e=>{if(e.addRunDependency("gx-assets"),v.get("assets")==="1"){l("firstrun").hidden=!1;return}Promise.all([ne(),$.ready]).then(async([n])=>{if(n.length){for(const s of n)$.mount(e,s);p(`Streaming ${n.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await re()){l("firstrun").hidden=!1,l("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const t=await ee();if(t.missing){l("firstrun").hidden=!1,p("Game archives not found — waiting for the player to point at their install.");return}for(const s of t.entries)$.mount(e,s);const r=t.entries.reduce((s,a)=>s+a.size,0);p(`Streaming ${t.entries.length} game archives (${(r/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(n=>{p(`Asset manifest failed: ${n.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const n=e.FS;n.mkdirTree(X),n.mount(e.IDBFS,{},X),n.syncfs(!0,()=>{const t=`${X}/Options.ini`;let r=!0;try{n.stat(t)}catch{r=!1}if((!r||v.get("resetOptions")==="1")&&n.writeFile(t,ie),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",a=n.readFile(t,{encoding:"utf8"});n.writeFile(t,/^Resolution = /m.test(a)?a.replace(/^Resolution = .*$/m,s):`${a}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>n.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>n.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};Z.onRuntimeInitialized=function(){b=this,globalThis.__gx=this,E.dataset.ready="true";const e=sessionStorage.getItem("generalsX.lanClient"),n=Number(v.get("lanClient")??e??0)||de();sessionStorage.setItem("generalsX.lanClient",String(n)),l("share").hidden=!1;const t=y[n]??`Player${n}`,r=setInterval(()=>{b?.ccall?.("GeneralsXLanSetName","number",["string"],[t])&&clearInterval(r)},500);if(_("Running"),S(),M){const s=setInterval(()=>{b?._GeneralsXSetAudioMuted?.(1)&&clearInterval(s)},500)}};_("Loading…");const ue=(await K(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;ue(Z);
