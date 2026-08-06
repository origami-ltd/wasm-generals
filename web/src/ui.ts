/** Page chrome: HUD header, framed canvas stage, and the first-run ownership gate. */

export const STEAM_HELP = `
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
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;

export function render(root: HTMLElement): void {
  root.className = "flex min-h-svh flex-col";
  root.innerHTML = `
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
          <button id="play" hidden
                  class="absolute inset-0 z-[7] grid place-items-center bg-[hsl(210_100%_2%/.9)] text-hud-accent">
            <span class="hud-cut px-10 py-5 text-2xl uppercase tracking-[0.2em]"
                  style="--hud-cut-surface: var(--color-hud-raised)">Play</span>
          </button>
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
              <div id="firstrun-info-panel" hidden class="mt-4 space-y-2 border-l-[3px] border-hud-accent bg-[hsl(210_100%_4%)] p-3.5 text-xs text-hud-muted">${STEAM_HELP}</div>
            </div>
          </div>
        </section>
      </div>

      <details class="hud-cut px-3 py-2 text-sm" style="--hud-cut-surface: var(--color-hud-surface)">
        <summary class="cursor-pointer text-hud-muted">Runtime log</summary>
        <textarea id="output" readonly aria-label="Runtime log"
                  class="mt-2 h-48 w-full resize-none bg-black p-2 text-xs text-hud-muted"></textarea>
      </details>
    </main>`;
}

export const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
