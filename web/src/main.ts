import "./style.css";
import { ArchiveStreamer, loadManifest } from "./streaming";
import { el, render } from "./ui";
import type { EmscriptenModule, ModuleFactory } from "./types";

render(el("app"));

const canvas = el<HTMLCanvasElement>("canvas");
const frame = el("frame");
const stage = el("stage");
const output = el<HTMLTextAreaElement>("output");
const status = el("status");
const cursorOverlay = el<HTMLImageElement>("cursor-overlay");
const query = new URLSearchParams(location.search);

const USER_DATA_PATH = "/home/web_user/.local/share/GeneralsX/GeneralsZH";
const DEFAULT_OPTIONS = "Resolution = 1280 720\n";

/* ---------------------------------------------------------------- logging */
const pendingLines: string[] = [];
const shownLines: string[] = [];
let shipChain: Promise<unknown> = Promise.resolve();

function log(line: string): void {
  pendingLines.push(line);
  shownLines.push(line);
  if (shownLines.length > 512) shownLines.shift();
  output.value = `${shownLines.join("\n")}\n`;
  output.scrollTop = output.scrollHeight;
}

// sendBeacon silently drops payloads over ~64KB, which loses exactly the early boot lines.
function shipLog(useBeacon = false): void {
  if (!pendingLines.length) return;
  const chunk = `${pendingLines.join("\n")}\n`;
  pendingLines.length = 0;
  if (useBeacon) {
    navigator.sendBeacon("/GeneralsXLog", chunk);
    return;
  }
  shipChain = shipChain.then(() => fetch("/GeneralsXLog", { method: "POST", body: chunk }).catch(() => {}));
}
setInterval(() => shipLog(), 2000);
addEventListener("pagehide", () => shipLog(true));

// Emscripten clears its own status when loading finishes, which would blank ours right after
// onRuntimeInitialized set it — keep the last meaningful text instead.
const setStatus = (text: string): void => {
  status.textContent = text || status.textContent || "";
};

/* --------------------------------------------------------- boot / display */
const bootMode = (query.get("boot") ?? localStorage.getItem("generalsX.bootMode")) === "full" ? "full" : "fast";
const soundEnabled = query.get("sound") !== "0";
let soundMuted = localStorage.getItem("generalsX.soundMuted") === "1";

const runtimeArguments: string[] = bootMode === "fast" ? ["-quickstart", "-noshellmap"] : [];
if (!soundEnabled) runtimeArguments.push("-noaudio");

el<HTMLSelectElement>("boot").value = bootMode;
el<HTMLSelectElement>("boot").addEventListener("change", (event) => {
  localStorage.setItem("generalsX.bootMode", (event.target as HTMLSelectElement).value);
  location.reload();
});

const aspect = el<HTMLSelectElement>("aspect");
aspect.value = localStorage.getItem("generalsX.aspect") === "4:3" ? "4:3" : "16:9";
aspect.addEventListener("change", () => {
  localStorage.setItem("generalsX.aspect", aspect.value);
  localStorage.setItem("generalsX.aspectApply", "1");
  location.reload();
});

el("reset").addEventListener("click", () => {
  localStorage.clear();
  document.cookie = "gxsteam=; Path=/; Max-Age=0";
  indexedDB.deleteDatabase("generalsx");
  location.reload();
});

/* ------------------------------------------------------------ first-run gate */
el("firstrun-steam").addEventListener("click", () => {
  // Popup, not a redirect: a full navigation would throw away the loaded runtime.
  open("/GeneralsXSteamLogin", "gx-steam", "width=820,height=720");
  addEventListener("message", (event) => {
    if (event.data === "gx-steam-done") location.reload();
  }, { once: true });
});
el("firstrun-info").addEventListener("click", () => {
  const panel = el("firstrun-info-panel");
  panel.hidden = !panel.hidden;
});
el("firstrun-folder").addEventListener("click", async () => {
  const note = el("firstrun-folder-note");
  const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<unknown> }).showDirectoryPicker;
  if (!picker) {
    note.textContent = "This browser cannot pick folders — use Chrome, or the Steam option.";
    return;
  }
  try {
    const zeroHour = await picker({ id: "generalsx-zerohour", mode: "read" });
    note.textContent = "Now select the base Generals folder…";
    const generals = await picker({ id: "generalsx-generals", mode: "read" });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("generalsx", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("handles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = database.transaction("handles", "readwrite").objectStore("handles");
    store.put(zeroHour, "GeneralsZH");
    store.put(generals, "Generals");
    note.textContent = "Folders saved. Reloading…";
    setTimeout(() => location.reload(), 600);
  } catch (error) {
    note.textContent = `Folder selection cancelled: ${(error as Error).message}`;
  }
});

/* ------------------------------------------------------------- letterboxing */
// JS owns the fit: the engine controls the canvas backing size, which CSS max-% cannot contain.
function fitCanvas(): void {
  const fullscreen = document.fullscreenElement === frame;
  // Cap by the viewport too: a grid track can still report more than the window during layout.
  const availableWidth = Math.min(fullscreen ? innerWidth : stage.clientWidth, innerWidth) - 16;
  const availableHeight = Math.min(fullscreen ? innerHeight : stage.clientHeight, innerHeight) - 16;
  const scale = Math.min(availableWidth / (canvas.width || 1), availableHeight / (canvas.height || 1));
  canvas.style.width = `${Math.max(1, Math.floor((canvas.width || 1) * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.floor((canvas.height || 1) * scale))}px`;
}
new ResizeObserver(fitCanvas).observe(stage);
new MutationObserver(fitCanvas).observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
addEventListener("resize", fitCanvas);
document.addEventListener("fullscreenchange", fitCanvas);

// Fullscreen the frame, not the canvas: the drawn cursor overlay must stay inside the fullscreened subtree.
el("fullscreen").addEventListener("click", () => void frame.requestFullscreen().catch(() => {}));

/* ------------------------------------------------------------------ cursor */
let overlaySource = "";

function drawLockedCursor(): void {
  if (document.pointerLockElement !== canvas) return;
  const x = module?._GeneralsXMouseX?.() ?? -1;
  const y = module?._GeneralsXMouseY?.() ?? -1;
  const match = /url\(\s*"?([^")]+)"?\s*\)(?:\s+(\d+)\s+(\d+))?/.exec(canvas.style.cursor);
  if (match && x >= 0 && y >= 0) {
    const [, url, hotX = "0", hotY = "0"] = match;
    if (url !== overlaySource) {
      overlaySource = url as string;
      cursorOverlay.src = url as string;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / (canvas.width || 1);
    const scaleY = rect.height / (canvas.height || 1);
    cursorOverlay.hidden = false;
    cursorOverlay.style.transform =
      `translate(${rect.left + x * scaleX - Number(hotX)}px, ${rect.top + y * scaleY - Number(hotY)}px)`;
  } else {
    cursorOverlay.hidden = true;
  }
  requestAnimationFrame(drawLockedCursor);
}

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  canvas.classList.toggle("pointer-locked", locked);
  if (locked) drawLockedCursor();
  else cursorOverlay.hidden = true;
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  if (!document.pointerLockElement && frame.dataset.ready === "true") canvas.requestPointerLock();
});

/* ------------------------------------------------------------------- sound */
function setSoundMuted(muted: boolean): void {
  soundMuted = muted;
  localStorage.setItem("generalsX.soundMuted", muted ? "1" : "0");
  module?._GeneralsXSetAudioMuted?.(muted ? 1 : 0);
  el("sound").textContent = muted ? "Sound off" : "Sound on";
}
el("sound").addEventListener("click", () => setSoundMuted(!soundMuted));
el("sound").textContent = soundMuted ? "Sound off" : "Sound on";

/* ------------------------------------------------------------------- boot */
const streamer = new ArchiveStreamer(log);
let module: EmscriptenModule | undefined;

el("cap-wasm").textContent = typeof WebAssembly === "object" ? "WASM ready" : "WASM missing";
el("cap-webgpu").textContent = "gpu" in navigator ? "WebGPU ready" : "WebGPU missing";

const config: Record<string, unknown> = {
  canvas,
  arguments: runtimeArguments,
  print: (line: string) => log(line),
  printErr: (line: string) => log(line),
  setStatus,
  preRun: [
    // Ownership gate: no proof, no game. The dependency is deliberately never removed when it fails.
    (instance: EmscriptenModule) => {
      instance.addRunDependency("gx-ownership");
      // ?assets=1 re-opens the panel to point at a different install without clearing everything.
      if (query.get("assets") === "1") {
        el("firstrun").hidden = false;
        return; // dependency stays: game waits for a fresh choice
      }
      fetch("/GeneralsXSteamSession")
        .then((response) => response.json())
        .then((session: { gate: boolean; authenticated: boolean; owns: boolean; name: string }) => {
          if (!session.gate || (session.authenticated && session.owns)) {
            if (session.gate) {
              const chip = el("steam-chip");
              chip.textContent = `STEAM ✓ ${session.name}`.trim();
              chip.classList.remove("hidden");
            }
            instance.removeRunDependency("gx-ownership");
            return;
          }
          el("firstrun").hidden = false;
          if (session.authenticated) el("firstrun-steam-note").textContent = "Ownership not confirmed on this account.";
        })
        .catch(() => instance.removeRunDependency("gx-ownership"));
    },
    // Archives stream on demand; without them the first-run panel explains how to point at the game.
    (instance: EmscriptenModule) => {
      instance.addRunDependency("gx-assets");
      Promise.all([loadManifest(), streamer.ready])
        .then(([manifest]) => {
          if (manifest.missing) {
            el("firstrun").hidden = false;
            log("Game archives not found — waiting for the player to point at their install.");
            return; // dependency stays: no game files, no game
          }
          for (const entry of manifest.entries) streamer.mount(instance, entry);
          const total = manifest.entries.reduce((sum, entry) => sum + entry.size, 0);
          log(`Streaming ${manifest.entries.length} game archives (${(total / 2 ** 30).toFixed(1)} GB) on demand.`);
          instance.removeRunDependency("gx-assets");
        })
        .catch((error: Error) => {
          log(`Asset manifest failed: ${error.message}`);
          instance.removeRunDependency("gx-assets");
        });
    },
    // The game is configured through Options.ini, so the user data dir must survive a reload.
    (instance: EmscriptenModule) => {
      instance.addRunDependency("gx-userdata");
      const FS = instance.FS;
      FS.mkdirTree(USER_DATA_PATH);
      FS.mount(instance.IDBFS, {}, USER_DATA_PATH);
      FS.syncfs(true, () => {
        const optionsPath = `${USER_DATA_PATH}/Options.ini`;
        let hasOptions = true;
        try {
          FS.stat(optionsPath);
        } catch {
          hasOptions = false;
        }
        if (!hasOptions || query.get("resetOptions") === "1") FS.writeFile(optionsPath, DEFAULT_OPTIONS);
        if (localStorage.getItem("generalsX.aspectApply") === "1") {
          const resolution = localStorage.getItem("generalsX.aspect") === "4:3"
            ? "Resolution = 1024 768"
            : "Resolution = 1280 720";
          const text = FS.readFile(optionsPath, { encoding: "utf8" });
          FS.writeFile(optionsPath, /^Resolution = /m.test(text)
            ? text.replace(/^Resolution = .*$/m, resolution)
            : `${text}${resolution}\n`);
          localStorage.removeItem("generalsX.aspectApply");
        }
        setInterval(() => FS.syncfs(false, () => {}), 10_000);
        addEventListener("pagehide", () => FS.syncfs(false, () => {}));
        instance.removeRunDependency("gx-userdata");
      });
    },
  ],
};

// main() never returns (it hands control to the browser main loop), so the factory promise never
// settles — readiness comes from onRuntimeInitialized instead of awaiting it.
config.onRuntimeInitialized = function (this: EmscriptenModule) {
  module = this;
  (globalThis as unknown as { __gx: EmscriptenModule }).__gx = this;
  frame.dataset.ready = "true";
  setStatus("Running");
  fitCanvas();
  if (soundMuted) {
    const applySavedMute = setInterval(() => {
      if (module?._GeneralsXSetAudioMuted?.(1)) clearInterval(applySavedMute);
    }, 500);
  }
};

setStatus("Loading…");
const factory = (await import(/* @vite-ignore */ "/GeneralsXZH.js")).default as ModuleFactory;
void factory(config);
