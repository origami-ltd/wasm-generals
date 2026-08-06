(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Y="modulepreload",V=function(e){return"/"+e},U={},J=function(n,t,o){let s=Promise.resolve();if(t&&t.length>0){let i=function(l){return Promise.all(l.map(u=>Promise.resolve(u).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),c=a?.nonce||a?.getAttribute("nonce");s=i(t.map(l=>{if(l=V(l),l in U)return;U[l]=!0;const u=l.endsWith(".css"),m=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${m}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":Y,u||(p.as="script"),p.crossOrigin="",p.href=l,c&&p.setAttribute("nonce",c),document.head.appendChild(p),u)return new Promise((G,w)=>{p.addEventListener("load",G),p.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(i){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=i,window.dispatchEvent(a),!a.defaultPrevented)throw i}return s.then(i=>{for(const a of i||[])a.status==="rejected"&&r(a.reason);return n().catch(r)})},f=256*1024,Q=640*1024*1024,L=8,ee=`
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
  };`;class te{constructor(n){if(this.onError=n,!crossOriginIsolated){this.ready=Promise.resolve();return}this.worker=new Worker(URL.createObjectURL(new Blob([ee],{type:"text/javascript"}))),this.buffer=new SharedArrayBuffer(f*L+8),this.ready=new Promise(t=>this.worker?.addEventListener("message",t,{once:!0}))}cache=new Map;cached=0;nextIndex=new Map;worker=null;buffer=null;ready;fetchChunkSync(n,t,o,s=1){if(!this.worker||!this.buffer)return this.onError("SharedArrayBuffer unavailable: archives cannot stream."),new Uint8Array(0);const r=new Int32Array(this.buffer,0,2);Atomics.store(r,0,0);const i=t*f;this.worker.postMessage({url:o?"":new URL(n,location.href).href,handle:o,start:i,end:i+f*s-1,sab:this.buffer});const a=Date.now()+6e4;for(;Atomics.load(r,0)===0;)if(Date.now()>a)return this.onError(`Archive fetch timed out: ${n} chunk ${t}`),new Uint8Array(0);return Atomics.load(r,0)!==1?(this.onError(`Archive fetch failed: ${n} chunk ${t}`),new Uint8Array(0)):new Uint8Array(this.buffer.slice(8,8+(r[1]??0)))}takeChunk(n,t,o){const s=`${n}#${t}`,r=this.cache.get(s);if(r)return this.cache.delete(s),this.cache.set(s,r),r;const i=this.nextIndex.get(n)===t,a=this.fetchChunkSync(n,t,o,i?L:1);this.nextIndex.set(n,t+a.length/f);for(let l=0;l<a.length;l+=f){const u=a.subarray(l,Math.min(l+f,a.length)),m=`${n}#${t+l/f}`;this.cache.has(m)||(this.cache.set(m,u),this.cached+=u.length)}const c=this.cache.get(s)??a.subarray(0,f);for(;this.cached>Q&&this.cache.size>1;){const l=this.cache.keys().next().value;this.cached-=this.cache.get(l)?.length??0,this.cache.delete(l)}return c}async warm(n,t=256*1024*1024){let o=0;for(const s of n)for(let r=0;r*f<s.size;r+=L){if(o>=t)return;const i=`${s.url}#${r}`;if(this.cache.has(i))continue;const a=r*f,c=Math.min(a+f*L,s.size)-1;try{const l=s.handle?new Uint8Array(await(await s.handle.getFile()).slice(a,c+1).arrayBuffer()):new Uint8Array(await(await fetch(s.url,{headers:{Range:`bytes=${a}-${c}`}})).arrayBuffer());for(let u=0;u<l.length;u+=f){const m=`${s.url}#${r+u/f}`;if(this.cache.has(m))continue;const p=l.subarray(u,Math.min(u+f,l.length));this.cache.set(m,p),this.cached+=p.length}o+=l.length}catch{return}await new Promise(l=>setTimeout(l,0))}}mount(n,t){const o=n.FS;o.mkdirTree(t.mount);const s=o.createFile(t.mount,t.name,{},!0,!1),r=t.size;Object.defineProperty(s,"usedBytes",{get:()=>r}),s.stream_ops={llseek:(i,a,c)=>{let l=a;if(c===1?l+=i.position:c===2&&(l=r+a),l<0)throw new o.ErrnoError(28);return l},read:(i,a,c,l,u)=>{const m=Math.min(r,u+l);if(u>=m)return 0;const p=Math.floor(u/f),G=Math.floor((m-1)/f);let w=0;for(let k=p;k<=G;k+=1){const H=this.takeChunk(t.url,k,t.handle),A=k*f,$=Math.max(u,A)-A,O=Math.min(m,A+H.length)-A;if(O<=$)break;a.set(H.subarray($,O),c+w),w+=O-$}return w}}}}async function ne(){return await(await fetch("/GeneralsXAssets")).json()}async function se(e,n=3){const t=new Map,o=async(s,r)=>{let i=!1,a=!1;const c=[];for await(const[l,u]of s.entries())u.kind==="directory"?c.push(u):l.toLowerCase().endsWith(".big")&&(/zh\.big$/i.test(l)?i=!0:a=!0);if(i&&!t.has("GeneralsZH")?t.set("GeneralsZH",s):a&&!i&&!t.has("Generals")&&t.set("Generals",s),!(t.size===2||r>=n)){for(const l of c)if(await o(l,r+1),t.size===2)return}};return await o(e,0),t}async function re(){try{return await ae()}catch(e){return console.debug("local archives unavailable",e),[]}}async function ae(){const n=(await new Promise((r,i)=>{const a=indexedDB.open("generalsx",1);a.onupgradeneeded=()=>a.result.createObjectStore("handles"),a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error)})).transaction("handles","readonly").objectStore("handles"),t=r=>new Promise(i=>{const a=n.get(r);a.onsuccess=()=>i(a.result),a.onerror=()=>i(void 0)}),o={GeneralsZH:t("GeneralsZH"),Generals:t("Generals")},s=[];for(const r of["GeneralsZH","Generals"]){const i=await o[r];if(i){if(await i.queryPermission?.({mode:"read"})!=="granted"&&await i.requestPermission?.({mode:"read"})!=="granted")return[];for await(const[a,c]of i.entries()){if(!a.toLowerCase().endsWith(".big")||c.kind!=="file")continue;const l=await c.getFile();s.push({mount:`/${r}`,name:a,url:`local:${r}/${a}`,size:l.size,handle:c})}}}return s}async function oe(){try{const e=await new Promise((n,t)=>{const o=indexedDB.open("generalsx",1);o.onupgradeneeded=()=>o.result.createObjectStore("handles"),o.onsuccess=()=>n(o.result),o.onerror=()=>t(o.error)});return await new Promise(n=>{const t=e.transaction("handles","readonly").objectStore("handles").count();t.onsuccess=()=>n(t.result>0),t.onerror=()=>n(!1)})}catch{return!1}}const ie=`
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
    </main>`}const d=e=>document.getElementById(e);le(d("app"));const h=d("canvas"),_=d("frame"),X=d("stage"),R=d("output"),D=d("status"),y=d("cursor-overlay"),v=new URLSearchParams(location.search),T="/home/web_user/.local/share/GeneralsX/GeneralsZH",ce=`Resolution = 1280 720
`,E=[],C=[];let j=Promise.resolve();function g(e){E.push(e),C.push(e),C.length>512&&C.shift(),R.value=`${C.join(`
`)}
`,R.scrollTop=R.scrollHeight}function q(e=!1){if(!E.length)return;const n=`${E.join(`
`)}
`;if(E.length=0,e){navigator.sendBeacon("/GeneralsXLog",n);return}j=j.then(()=>fetch("/GeneralsXLog",{method:"POST",body:n}).catch(()=>{}))}setInterval(()=>q(),2e3);addEventListener("pagehide",()=>q(!0));const P=e=>{D.textContent=e||D.textContent||""},N=(v.get("boot")??localStorage.getItem("generalsX.bootMode"))==="full"?"full":"fast",de=v.get("sound")!=="0";let I=localStorage.getItem("generalsX.soundMuted")==="1";const z=N==="fast"?["-quickstart","-noshellmap"]:[];de||z.push("-noaudio");d("boot").value=N;d("boot").addEventListener("change",e=>{localStorage.setItem("generalsX.bootMode",e.target.value),location.reload()});const F=d("aspect");F.value=localStorage.getItem("generalsX.aspect")==="4:3"?"4:3":"16:9";F.addEventListener("change",()=>{localStorage.setItem("generalsX.aspect",F.value),localStorage.setItem("generalsX.aspectApply","1"),location.reload()});d("reset").addEventListener("click",()=>{localStorage.clear(),indexedDB.deleteDatabase("generalsx"),location.reload()});d("share").addEventListener("click",async()=>{const e=d("share"),{url:n}=await(await fetch("/GeneralsXShare")).json();await navigator.clipboard?.writeText(n).catch(()=>{});const t=e.textContent;e.textContent="Link copied",setTimeout(()=>{e.textContent=t},1800)});d("firstrun-info").addEventListener("click",()=>{const e=d("firstrun-info-panel");e.hidden=!e.hidden});d("firstrun-folder").addEventListener("click",async()=>{const e=d("firstrun-folder-note"),n=window.showDirectoryPicker;if(!n){e.textContent="This browser cannot pick folders — use Chrome or Edge.";return}try{const t=await n({id:"generalsx-install",mode:"read"});e.textContent="Scanning…";const o=await se(t);if(!o.has("GeneralsZH")){e.textContent="No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";return}const r=(await new Promise((i,a)=>{const c=indexedDB.open("generalsx",1);c.onupgradeneeded=()=>c.result.createObjectStore("handles"),c.onsuccess=()=>i(c.result),c.onerror=()=>a(c.error)})).transaction("handles","readwrite").objectStore("handles");for(const[i,a]of o)r.put(a,i);e.textContent=`Found ${[...o.keys()].join(" + ")}. Starting…`,setTimeout(()=>location.replace(location.pathname),700)}catch(t){console.debug("folder selection cancelled",t),e.textContent=""}});function S(){const e=document.fullscreenElement===_,n=Math.min(e?innerWidth:X.clientWidth,innerWidth)-16,t=Math.min(e?innerHeight:X.clientHeight,innerHeight)-16,o=Math.min(n/(h.width||1),t/(h.height||1));h.style.width=`${Math.max(1,Math.floor((h.width||1)*o))}px`,h.style.height=`${Math.max(1,Math.floor((h.height||1)*o))}px`}new ResizeObserver(S).observe(X);new MutationObserver(S).observe(h,{attributes:!0,attributeFilter:["width","height"]});addEventListener("resize",S);document.addEventListener("fullscreenchange",S);d("fullscreen").addEventListener("click",()=>void _.requestFullscreen().catch(()=>{}));let W="";function Z(){if(document.pointerLockElement!==h)return;const e=b?._GeneralsXMouseX?.()??-1,n=b?._GeneralsXMouseY?.()??-1,t=/url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(h.style.cursor);if(t&&e>=0&&n>=0){const[,o,s="0",r="0"]=t;o!==W&&(W=o,y.src=o);const i=h.getBoundingClientRect(),a=i.width/(h.width||1),c=i.height/(h.height||1);y.hidden=!1,y.style.transform=`translate(${i.left+e*a-Number(s)}px, ${i.top+n*c-Number(r)}px)`}else y.hidden=!0;requestAnimationFrame(Z)}document.addEventListener("pointerlockchange",()=>{const e=document.pointerLockElement===h;h.classList.toggle("pointer-locked",e),e?Z():y.hidden=!0});h.addEventListener("contextmenu",e=>e.preventDefault());h.addEventListener("pointerdown",()=>{h.focus(),!document.pointerLockElement&&_.dataset.ready==="true"&&h.requestPointerLock()});function ue(e){I=e,localStorage.setItem("generalsX.soundMuted",e?"1":"0"),b?._GeneralsXSetAudioMuted?.(e?1:0),d("sound").textContent=e?"Sound off":"Sound on"}d("sound").addEventListener("click",()=>ue(!I));d("sound").textContent=I?"Sound off":"Sound on";crossOriginIsolated||P("Open this page over https:// — the browser blocks shared memory otherwise.");const x=["","emscripten","wasm","Reporting","YesSir","MoveOut","Affirmative","Rockets","OnTheWay","TargetSighted","ForTheMotherland","DeathFromAbove","AtOnce","IObey","ChinaWillGrow","GLAWillPrevail","USAWillProtect","AwaitingOrders","InPosition","TakingFire","ChargeTheAttack","ScudLaunch","AirForceOne","Overlord","Toxin"];function he(){let e=Number(localStorage.getItem("generalsX.lanOffset"));e||(e=Math.floor(Math.random()*(x.length-1))+1,localStorage.setItem("generalsX.lanOffset",String(e)));const n=new Set((localStorage.getItem("generalsX.lanUsed")??"").split(",").filter(Boolean).map(Number));for(let t=0;t<x.length-1;t+=1){const o=(e-1+t)%(x.length-1)+1;if(!n.has(o))return n.add(o),localStorage.setItem("generalsX.lanUsed",[...n].join(",")),o}return Math.floor(Math.random()*(x.length-1))+1}const M=new te(g);function B(e){const n=e.filter(t=>/^(audio|music|speech)/i.test(t.name));M.warm(n).then(()=>g("Audio archives cached locally."))}let b;d("cap-wasm").textContent=typeof WebAssembly=="object"?"WASM ready":"WASM missing";d("cap-webgpu").textContent="gpu"in navigator?"WebGPU ready":"WebGPU missing";const K={canvas:h,arguments:z,print:e=>g(e),printErr:e=>g(e),setStatus:P,preRun:[e=>{if(e.addRunDependency("gx-assets"),v.get("assets")==="1"){d("firstrun").hidden=!1;return}Promise.all([re(),M.ready]).then(async([n])=>{if(n.length){for(const s of n)M.mount(e,s);B(n),g(`Streaming ${n.length} archives from your selected folders.`),e.removeRunDependency("gx-assets");return}if(await oe()){d("firstrun").hidden=!1,d("firstrun-folder-note").textContent="Click to re-allow access to your game folder.";return}const t=await ne();if(t.missing){d("firstrun").hidden=!1,g("Game archives not found — waiting for the player to point at their install.");return}for(const s of t.entries)M.mount(e,s);B(t.entries);const o=t.entries.reduce((s,r)=>s+r.size,0);g(`Streaming ${t.entries.length} game archives (${(o/2**30).toFixed(1)} GB) on demand.`),e.removeRunDependency("gx-assets")}).catch(n=>{g(`Asset manifest failed: ${n.message}`),e.removeRunDependency("gx-assets")})},e=>{e.addRunDependency("gx-userdata");const n=e.FS;n.mkdirTree(T),n.mount(e.IDBFS,{},T),n.syncfs(!0,()=>{const t=`${T}/Options.ini`;let o=!0;try{n.stat(t)}catch{o=!1}if((!o||v.get("resetOptions")==="1")&&n.writeFile(t,ce),localStorage.getItem("generalsX.aspectApply")==="1"){const s=localStorage.getItem("generalsX.aspect")==="4:3"?"Resolution = 1024 768":"Resolution = 1280 720",r=n.readFile(t,{encoding:"utf8"});n.writeFile(t,/^Resolution = /m.test(r)?r.replace(/^Resolution = .*$/m,s):`${r}${s}
`),localStorage.removeItem("generalsX.aspectApply")}setInterval(()=>n.syncfs(!1,()=>{}),1e4),addEventListener("pagehide",()=>n.syncfs(!1,()=>{})),e.removeRunDependency("gx-userdata")})}]};K.onRuntimeInitialized=function(){b=this,globalThis.__gx=this,_.dataset.ready="true";const e=sessionStorage.getItem("generalsX.lanClient"),n=Number(v.get("lanClient")??e??0)||he();sessionStorage.setItem("generalsX.lanClient",String(n)),d("share").hidden=!1;const t=x[n]??`Player${n}`,o=setInterval(()=>{b?.ccall?.("GeneralsXLanSetName","number",["string"],[t])&&clearInterval(o)},500);if(P("Running"),S(),I){const s=setInterval(()=>{b?._GeneralsXSetAudioMuted?.(1)&&clearInterval(s)},500)}};P("Loading…");const fe=(await J(async()=>{const{default:e}=await import("/GeneralsXZH.js");return{default:e}},[])).default;fe(K);
