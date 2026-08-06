import "./style.css";
import { initConsole } from "./console";
import { ArchiveStreamer, findArchiveDirs, hasSavedFolders, loadManifest, localArchives } from "./streaming";
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

let menuPending = false;
let menuUp = false;
let loadActiveAt = 0; // last GENERALSX_LOAD_PROGRESS: the engine is inside a load right now

/** The engine narrates its boot; mirror that into the status line and only call it Running when
    the shell reports the main menu is up. Logic frames tick well before anything is drawn. */
function trackBoot(line: string): void {
  // The match load screen itself is the game's own (teams, factions, map) — the page only uses
  // these markers to know a load is running, so it stops auto-resuming the silenced audio.
  if (line.startsWith("GENERALSX_LOAD_PROGRESS")) loadActiveAt = Date.now();
  if (menuUp) return;
  if (line.includes("MainMenu.wnd")) menuPending = true;
  if (menuPending && line.includes("Push completed")) {
    menuUp = true;
    report("Running", "");
    return;
  }
  const subsystem = /initSubsystem\('([^']+)'\)/.exec(line);
  if (subsystem) report("Starting engine", `initialising ${subsystem[1]}`);
  else if (line.startsWith("[INI] load(")) {
    report("Starting engine", `reading ${line.slice(11, line.indexOf(")"))}`);
  }
}

function log(line: string): void {
  trackBoot(line);
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
const detail = el("status-detail");
const track = el("progress-track");
const bar = el("progress-bar");

/** Everything the page is doing lives here: headline, detail line, and a bar when there is a ratio. */
function report(headline: string, note = "", ratio?: number): void {
  if (headline) status.textContent = headline;
  detail.textContent = note;
  track.hidden = ratio === undefined;
  if (ratio !== undefined) bar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
}

// Emscripten clears its own status when loading finishes, which would blank ours right after
// onRuntimeInitialized set it — keep the last meaningful text instead.
const setStatus = (text: string): void => {
  const match = /\((\d+)\/(\d+)\)/.exec(text);
  if (match) {
    const done = Number(match[1]);
    const total = Number(match[2]);
    report("Loading runtime", `${(done / 2 ** 20).toFixed(1)} / ${(total / 2 ** 20).toFixed(1)} MB`, done / total);
    return;
  }
  if (text) report(text);
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
  indexedDB.deleteDatabase("generalsx");
  location.reload();
});

/* ------------------------------------------------------------ first-run gate */
// Share the running host with players on the same network: they stream the archives from here.
el("share").addEventListener("click", async () => {
  const button = el("share");
  const { url } = (await (await fetch("/GeneralsXShare")).json()) as { url: string };
  await navigator.clipboard?.writeText(url).catch(() => {});
  const label = button.textContent;
  button.textContent = "Link copied";
  setTimeout(() => { button.textContent = label; }, 1800);
});

el("firstrun-info").addEventListener("click", () => {
  const panel = el("firstrun-info-panel");
  panel.hidden = !panel.hidden;
});
el("firstrun-folder").addEventListener("click", async () => {
  const note = el("firstrun-folder-note");
  const picker = (window as unknown as {
    showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) {
    note.textContent = "This browser cannot pick folders — use Chrome or Edge.";
    return;
  }
  try {
    const root = await picker({ id: "generalsx-install", mode: "read" });
    note.textContent = "Scanning…";
    const found = await findArchiveDirs(root);
    if (!found.has("GeneralsZH")) {
      note.textContent = "No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";
      return;
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("generalsx", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("handles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = database.transaction("handles", "readwrite").objectStore("handles");
    for (const [key, handle] of found) store.put(handle, key);
    note.textContent = `Found ${[...found.keys()].join(" + ")}. Starting…`;
    // Drop ?assets=1: reloading with it would just reopen this panel forever.
    setTimeout(() => location.replace(location.pathname), 700);
  } catch (error) {
    console.debug("folder selection cancelled", error);
    note.textContent = "";
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

/* ------------------------------------------------------------------- pause */
// Esc cannot pause in a browser: the pointer-lock exit consumes the key before the engine ever
// sees it, so Esc only releases the mouse. Focus is the pause signal instead — click outside the
// game surface (or hide the tab) and the sim pauses; click back on the canvas and it resumes.
// The engine refuses the call in LAN matches, where the other players' simulation marches on.
function setPaused(paused: boolean): void {
  module?.ccall?.("GeneralsXSetPaused", "number", ["number"], [paused ? 1 : 0]);
}
addEventListener("pointerdown", (event) => {
  setPaused(!frame.contains(event.target as Node));
}, { capture: true });
addEventListener("blur", () => setPaused(true));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
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

/** WebAudio context states, for the console and the runtime log — silence debugging needs this. */
function audioContextStates(): string {
  const devices = (window as unknown as { miniaudio?: { devices?: { webaudio?: AudioContext }[] } }).miniaudio?.devices;
  return devices?.map((device) => device?.webaudio?.state ?? "?").join(",") || "no-device";
}

initConsole({
  module: () => module,
  mute: () => {
    setSoundMuted(!soundMuted);
    return soundMuted ? "Sound muted." : "Sound on.";
  },
  status: () => `status=${status.textContent} audio=${audioContextStates()} muted=${soundMuted}`
    + ` logic=${module?._GeneralsXLogicFrame?.() ?? 0}`
    + ` cursor=${document.pointerLockElement ? "captured" : "free"}`,
  sync: () => guestBulk
    ? `${guestBulk.finished ? "done" : "syncing"} ${(guestBulk.done / 2 ** 20).toFixed(0)}/${(guestBulk.total / 2 ** 20).toFixed(0)} MB · ${guestBulk.file}`
    : "no guest sync in this session",
});

/* ------------------------------------------------------------------- boot */
if (!crossOriginIsolated) {
  // SharedArrayBuffer is what makes streaming possible; without a secure context there is no game.
  setStatus("Open this page over https:// — the browser blocks shared memory otherwise.");
}
// Names shown in the LAN lobby. Index 1 and 2 are the build's own, the rest are the general's
// callouts everyone who played this game hears in their sleep.
const LAN_NAMES = [
  "", "emscripten", "wasm", "Reporting", "YesSir", "MoveOut", "Affirmative", "Rockets",
  "OnTheWay", "TargetSighted", "ForTheMotherland", "DeathFromAbove", "AtOnce", "IObey",
  "ChinaWillGrow", "GLAWillPrevail", "USAWillProtect", "AwaitingOrders", "InPosition",
  "TakingFire", "ChargeTheAttack", "ScudLaunch", "AirForceOne", "Overlord", "Toxin",
];

/** Next free name for this browser profile. The starting point is random per profile, so two
    separate profiles (or two machines) do not both open on "emscripten" and hide each other. */
function nextLanClient(): number {
  let offset = Number(localStorage.getItem("generalsX.lanOffset"));
  if (!offset) {
    offset = Math.floor(Math.random() * (LAN_NAMES.length - 1)) + 1;
    localStorage.setItem("generalsX.lanOffset", String(offset));
  }
  const used = new Set(
    (localStorage.getItem("generalsX.lanUsed") ?? "").split(",").filter(Boolean).map(Number),
  );
  for (let step = 0; step < LAN_NAMES.length - 1; step += 1) {
    const index = ((offset - 1 + step) % (LAN_NAMES.length - 1)) + 1;
    if (!used.has(index)) {
      used.add(index);
      localStorage.setItem("generalsX.lanUsed", [...used].join(","));
      return index;
    }
  }
  return Math.floor(Math.random() * (LAN_NAMES.length - 1)) + 1;
}

const streamer = new ArchiveStreamer(log);
let lastManifest: { name: string; size: number; url: string; mount: string }[] | null = null;

/* -------------------------------------------------------------- guest sync */
// Served from another machine's link (https://<lan-ip>:8765): every archive byte crosses the
// network, and a mid-frame read there is heard as a stutter. Local files never stutter, so the
// full pull below only exists for guests.
// ?guest=1 forces the guest flow on localhost, for testing the sync screen without two machines.
const isGuest = query.get("guest") === "1"
  || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let guestBulk: { done: number; total: number; file: string; finished: boolean } | null = null;

/** The engine polls this inside the match load screen and refuses to start the match while 1. */
function setHoldMatch(hold: boolean): void {
  (globalThis as unknown as { __gxHoldMatch?: number }).__gxHoldMatch = hold ? 1 : 0;
}

const holo = el("holo");
let holoTimer: ReturnType<typeof setInterval> | undefined;

function holoShow(): void {
  if (!holo.hidden) return;
  holo.hidden = false;
  holoTimer = setInterval(() => {
    if (!guestBulk) return;
    const ratio = guestBulk.total ? guestBulk.done / guestBulk.total : 0;
    el("holo-percent").textContent = `${Math.floor(ratio * 100)}%`;
    el("holo-mb").textContent =
      `${(guestBulk.done / 2 ** 20).toFixed(0)} / ${(guestBulk.total / 2 ** 20).toFixed(0)} MB`;
    el("holo-file").textContent = guestBulk.finished ? "arsenal complete" : guestBulk.file;
  }, 250);
}

function holoHide(): void {
  if (holo.hidden) return;
  holo.hidden = true;
  clearInterval(holoTimer);
}

/** The whole game, pulled behind the hologram BEFORE the game opens: the guest waits here once,
    then plays with everything local. Menu art and the full sound set go into memory, the bulk
    into the browser's disk cache. In-game loads then use the game's own load screen untouched.
    The engine-side hold stays raised while this runs as a belt-and-braces guard, but in this flow
    the download always lands before the engine even boots. */
async function guestPreload(entries: { name: string; size: number }[]): Promise<void> {
  const warmSet = entries.filter((entry) => MENU_ARCHIVES.test(entry.name));
  const primeSet = entries.filter((entry) => !MENU_ARCHIVES.test(entry.name));
  const warmTotal = warmSet.reduce((sum, entry) => sum + entry.size, 0);
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  guestBulk = { done: 0, total, file: "contacting host…", finished: false };
  setHoldMatch(true);
  holoShow();
  const seen = (base: number) => (done: number, name: string): void => {
    if (!guestBulk) return;
    guestBulk.done = base + done;
    guestBulk.file = name;
    report("Downloading", `${name} · ${((base + done) / 2 ** 20).toFixed(0)}/${(total / 2 ** 20).toFixed(0)} MB`,
      (base + done) / total);
  };
  try {
    await streamer.warm(warmSet as never, Number.MAX_SAFE_INTEGER, seen(0));
    await streamer.prime(primeSet as never, seen(warmTotal));
    log("Full game synced from the host.");
  } catch {
    log("Guest sync stopped early — archives stream on demand instead.");
  } finally {
    if (guestBulk) {
      guestBulk.done = guestBulk.total;
      guestBulk.finished = true;
    }
    setHoldMatch(false);
    holoHide();
    report("", "");
  }
}

// Chrome suspends an AudioContext created without user activation; miniaudio keeps feeding it and
// the result is glitching, not silence. Resume on the first real gesture, and whenever the tab
// comes back — the engine also suspends the device around map loads.
function resumeAudio(): void {
  // Hands off while the engine is inside a load: it silences the device on purpose there, and a
  // resume would machine-gun the last rendered audio quantum. It resumes itself afterwards.
  if (Date.now() - loadActiveAt < 2000) return;
  const devices = (window as unknown as { miniaudio?: { devices?: { webaudio?: AudioContext }[] } }).miniaudio?.devices;
  let suspended = 0;
  for (const device of devices ?? []) {
    if (device?.webaudio?.state === "suspended" && !document.hidden) {
      suspended += 1;
      void device.webaudio.resume();
    }
  }
  if (suspended) log(`Audio context suspended by the browser; resuming (${suspended}).`);
}
for (const event of ["pointerdown", "keydown", "visibilitychange"]) {
  addEventListener(event, resumeAudio, { capture: true });
}

/** Sound and music first: those are the reads that would otherwise stall a frame mid-battle. */
/** Two phases, because the files are always local or on the LAN: pull the whole game in, but pull
    what the menu needs first so Play is not held for gigabytes.
    Menu: INI, window/UI art, English strings, music. Match: everything else. */
const MENU_ARCHIVES = /^(ini|window|english|gensec|patch|audio|music|speech)/i;

function preloadEverything(entries: { name: string; size: number }[]): Promise<void> {
  // Audio is cheap and every miss is audible, so the whole sound set is pulled into memory up front
  // along with the menu. Textures and models stream — a late texture is a blank frame, not a glitch.
  const menu = entries.filter((entry) => MENU_ARCHIVES.test(entry.name));
  const match = entries.filter((entry) => !MENU_ARCHIVES.test(entry.name));
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  // Menu assets go into memory (small, needed immediately); the rest is primed into the browser's
  // disk cache so the whole game is local without holding gigabytes in the tab.
  return streamer
    .warm(menu as never, Number.MAX_SAFE_INTEGER, (done, name) =>
      report("", `Caching menu · ${name} · ${(done / 2 ** 20).toFixed(0)} MB`))
    .then(() => streamer.prime(match as never, (done, name) =>
      report("", `Caching game · ${name} · ${(done / 2 ** 20).toFixed(0)}/${(total / 2 ** 20).toFixed(0)} MB`,
        done / total)))
    .then(() => {
      report("", "");
      log("All archives cached locally.");
    });
}

function warmAudio(entries: { name: string; size: number }[]): void {
  // Anything read mid-frame stutters if it is not already in memory: sounds and textures alike.
  // Warm them in the order the game reaches for them.
  const priority = (name: string): number =>
    /^music/i.test(name) ? 0
    : /^audio.*zh/i.test(name) ? 1
    : /^audio/i.test(name) ? 2
    : 3; // speech last: big and least missed
  // Textures are deliberately not warmed wholesale: the set is larger than the cache, so it only
  // evicts the audio that was already there. They ride the normal streaming path instead.
  const audio = entries
    .filter((entry) => /^(audio|music|speech)/i.test(entry.name))
    .sort((a, b) => priority(a.name) - priority(b.name));
  const total = audio.reduce((sum, entry) => sum + entry.size, 0);
  void streamer
    .warm(audio as never, total, (done, name) =>
      report("", `Caching · ${name} · ${(done / 2 ** 20).toFixed(0)}/${(total / 2 ** 20).toFixed(0)} MB`,
        done / total))
    .then(() => {
      log("Audio archives cached locally.");
    });
}
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
    // Archives stream on demand; without them the first-run panel explains how to point at the game.
    (instance: EmscriptenModule) => {
      instance.addRunDependency("gx-assets");
      // ?assets=1 reopens the picker to point at a different install.
      if (query.get("assets") === "1") {
        el("firstrun").hidden = false;
        return; // dependency stays: wait for a fresh choice
      }
      Promise.all([localArchives(), streamer.ready])
        .then(async ([local]) => {
          // A picked install wins: read straight from the player's disk, server not involved.
          if (local.length) {
            for (const entry of local) streamer.mount(instance, entry);
            lastManifest = local;
            preloadEverything(local);
            log(`Streaming ${local.length} archives from your selected folders.`);
            instance.removeRunDependency("gx-assets");
            return;
          }
          if (await hasSavedFolders()) {
            // Handles exist but the browser wants a gesture to re-grant access on this load.
            el("firstrun").hidden = false;
            el("firstrun-folder-note").textContent = "Click to re-allow access to your game folder.";
            return; // dependency stays: booting now would mean booting with no archives
          }
          const manifest = await loadManifest();
          report("Mounting archives", `${manifest.entries.length} files`);
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
  // Every client needs its own LAN name: the lobby hides games hosted by a player with the same
  // name, so two tabs called "emscripten" can never see each other. sessionStorage is per tab, so
  // two tabs on one machine get different names and can play each other.
  const stored = sessionStorage.getItem("generalsX.lanClient");
  const lanClient = Number(query.get("lanClient") ?? stored ?? 0) || nextLanClient();
  sessionStorage.setItem("generalsX.lanClient", String(lanClient));
  el("share").hidden = false;
  const label = LAN_NAMES[lanClient] ?? `Player${lanClient}`;
  const nameLan = setInterval(() => {
    if (module?.ccall?.("GeneralsXLanSetName", "number", ["string"], [label])) clearInterval(nameLan);
  }, 500);
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

// Chrome refuses to start an AudioContext without user activation, and the engine creates its
// device during init — so the runtime only starts once the player has clicked Play.
const play = el<HTMLButtonElement>("play");

/** Pull a file into the HTTP cache with progress, so Play means "everything is here". */
async function preload(url: string, label: string): Promise<void> {
  const response = await fetch(url);
  const total = Number(response.headers.get("Content-Length") ?? 0);
  const reader = response.body?.getReader();
  let done = 0;
  while (reader) {
    const chunk = await reader.read();
    if (chunk.done) break;
    done += chunk.value.byteLength;
    report("Downloading", `${label} · ${(done / 2 ** 20).toFixed(0)}/${(total / 2 ** 20).toFixed(0)} MB`,
      total ? done / total : undefined);
  }
}

await preload("/GeneralsXZH.wasm", "engine");
await preload("/GeneralsXZH.data", "startup files");
const manifest = await loadManifest().catch(() => null);
if (manifest && !manifest.missing) {
  lastManifest = manifest.entries;
  // Everything lands before the game opens, for host and guest alike — mid-match network reads
  // are the stutter. The host sees the plain bar (disk-speed, seconds); the guest waits once
  // behind the hologram while the whole game crosses the LAN. In-game loads afterwards use the
  // game's own load screen, teams and all.
  if (isGuest) await guestPreload(manifest.entries);
  else await preloadEverything(manifest.entries);
}

play.hidden = false;
report("Ready", "everything downloaded — click Play to start audio");
play.addEventListener("click", () => {
  play.hidden = true;
  report("Starting engine", "loading game data");
  void factory(config);
  // The click is the user activation Chrome demands; sticky activation keeps later resumes legal.
  // Resume forever — Full Start creates its audio device long after the old 30-second settle
  // window closed, and the context then sat suspended and silent for the rest of the session.
  setInterval(resumeAudio, 1000);
}, { once: true });
