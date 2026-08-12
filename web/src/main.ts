import "./style.css";
import { initConsole } from "./console";
import { ArchiveStreamer, allSupported } from "@wasm/runtime";
import { createShell, el, query } from "@wasm/shell";
import { findArchiveDirs, folders, hasSavedFolders, loadManifest, localArchives } from "./archives";
import { STEAM_HELP } from "./ui";
import type { EmscriptenModule, ModuleFactory } from "./types";

const USER_DATA_PATH = "/home/web_user/.local/share/GeneralsX/GeneralsZH";
const DEFAULT_OPTIONS = "Resolution = 1280 720\n";

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

const shell = createShell({
  key: "generalsX",
  title: "GeneralsX",
  subtitle: "WebAssembly + WebGPU",
  game: "Command & Conquer: Generals — Zero Hour",
  gpu: "webgpu",
  heapBytes: 2 * 1024 ** 3, // -sINITIAL_MEMORY=2147483648 in cmake/webgpu.cmake
  help: STEAM_HELP,
  logEndpoint: "/GeneralsXLog",
  repo: "origami-ltd/wasm-generals",
  onLine: trackBoot,
  frame: () => module?._GeneralsXLogicFrame?.(),
  applyMute: (muted) => module?._GeneralsXSetAudioMuted?.(muted ? 1 : 0),
  pointer: {
    // An RTS wants the pointer for the whole session, and the engine draws its own cursor, so
    // the overlay mirrors where the engine thinks it is — under lock the OS one is hidden.
    wantsCapture: () => true,
    ready: () => el("frame").dataset.ready === "true",
    cursor: () => {
      const x = module?._GeneralsXMouseX?.() ?? -1;
      const y = module?._GeneralsXMouseY?.() ?? -1;
      return { x, y };
    },
  },
  assetDependency: "gx-assets",
  // Generals mounts from several folders, not one root, so mountPicked below reads them itself
  // and ignores the handle. What matters here is only whether re-granting succeeded.
  resumeSaved: async () =>
    ((await localArchives({ request: true })).length ? ({} as FileSystemDirectoryHandle) : undefined),
  mountPicked: async (instance) => {
    const local = await localArchives();
    await streamer.ready;
    for (const entry of local) streamer.mount(instance, entry);
    lastManifest = local;
    void preloadEverything(local);
    log(`Streaming ${local.length} archives from your selected folders.`);
  },
  onReset: () => folders.clear(),
  onPick: async (picked) => {
    const found = await findArchiveDirs(picked);
    if (!found.has("GeneralsZH")) {
      return "No Zero Hour archives (*ZH.big) under that folder — pick the install folder.";
    }
    await folders.save(found);
    return undefined;
  },
  controls: `
    <label class="flex items-center gap-2 text-sm text-muted"><span class="hidden lg:inline">Boot</span>
      <select id="boot" class="ogx-hud-select">
        <option value="fast">Fast start</option>
        <option value="full">Full start</option>
      </select>
    </label>
    <button id="share" hidden class="ogx-hud-button whitespace-nowrap" title="Copy the link for players on your network">Multiplayer</button>`,
  overlays: `
    <!-- Guest pre-game sync: one ring, one number, one line. Shown before the game opens
         while the menu minimum streams from the host. -->
    <div id="holo" hidden class="absolute inset-0 z-[8] grid place-items-center bg-bg/97">
      <div class="grid justify-items-center gap-4">
        <div class="ogx-ring-wrap">
          <svg class="ogx-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ogx-ring-track" cx="60" cy="60" r="54"></circle>
            <circle id="holo-ring-fill" class="ogx-ring-fill" cx="60" cy="60" r="54"></circle>
          </svg>
          <div class="ogx-ring-center">
            <div id="holo-percent" class="ogx-ring-percent">0%</div>
            <div id="holo-mb" class="ogx-ring-note mt-1">contacting host…</div>
          </div>
        </div>
        <div id="holo-file" class="ogx-ring-file">&nbsp;</div>
      </div>
    </div>

    <!-- Backtick developer console -->
    <div id="dev-console" hidden class="absolute inset-x-0 top-0 z-[9] flex max-h-[55%] flex-col border-b border-line bg-bg/92">
      <pre id="dev-console-output" class="m-0 flex-1 overflow-auto whitespace-pre-wrap p-2 text-xs text-ink"></pre>
      <form id="dev-console-form" class="flex items-center border-t border-line">
        <span class="px-2 py-1 text-xs text-accent">&gt;</span>
        <input id="dev-console-input" autocomplete="off" autocapitalize="off" spellcheck="false"
               class="min-w-0 flex-1 bg-transparent py-1 pr-2 text-xs text-ink outline-none">
      </form>
    </div>`,
});

const { log, gate, sound } = shell;
const { report, setStatus } = shell.status;
const canvas = el<HTMLCanvasElement>("canvas");
const statusLine = el("status");
const fitCanvas = shell.fit;

/* --------------------------------------------------------- boot / display */
const bootMode = (query.get("boot") ?? localStorage.getItem("generalsX.bootMode")) === "full" ? "full" : "fast";
const soundEnabled = !query.muted;

const runtimeArguments: string[] = bootMode === "fast" ? ["-quickstart", "-noshellmap"] : [];
if (!soundEnabled) runtimeArguments.push("-noaudio");
// ?args=-botmatch+... passes engine flags straight through — used by automated parity runs.
const extraArguments = query.get("args");
if (extraArguments) {
  // "|" separates when an argument itself contains spaces (map paths do).
  const parts = extraArguments.includes("|") ? extraArguments.split("|") : extraArguments.split(" ");
  runtimeArguments.push(...parts.filter(Boolean));
}

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

// Share the running host with players on the same network: they stream the archives from here.
el("share").addEventListener("click", async () => {
  const button = el("share");
  const label = button.textContent;
  try {
    const { url } = (await (await fetch("/GeneralsXShare")).json()) as { url: string };
    await navigator.clipboard?.writeText(url).catch(() => {});
    button.textContent = "Link copied";
  } catch {
    button.textContent = "LAN host only"; // static hosting has no relay to share
  }
  setTimeout(() => { button.textContent = label; }, 1800);
});

// ?assets=1 means the player came to repoint their install — open the picker immediately,
// before any engine bootstrapping gets a chance to sit in front of it.
if (query.pickInstall) gate.show();

// No auto-pause: the simulation keeps running whether or not the page has focus — losing focus
// must never stop a match (a hidden tab's frames are driven by the pump worker below).

/** WebAudio context states, for the console and the runtime log — silence debugging needs this. */
function audioContextStates(): string {
  const devices = (window as unknown as { miniaudio?: { devices?: { webaudio?: AudioContext }[] } }).miniaudio?.devices;
  return devices?.map((device) => device?.webaudio?.state ?? "?").join(",") || "no-device";
}

initConsole({
  module: () => module,
  mute: () => {
    sound.set(!sound.muted);
    return sound.muted ? "Sound muted." : "Sound on.";
  },
  status: () => `status=${statusLine.textContent} audio=${audioContextStates()} muted=${sound.muted}`
    + ` logic=${module?._GeneralsXLogicFrame?.() ?? 0}`
    + ` cursor=${document.pointerLockElement ? "captured" : "free"}`,
  sync: () => guestBulk
    ? `${guestBulk.finished ? "done" : "syncing"} ${(guestBulk.done / 2 ** 20).toFixed(0)}/${(guestBulk.total / 2 ** 20).toFixed(0)} MB · ${guestBulk.file}`
    : "no guest sync in this session",
});

/* ------------------------------------------------------------------- boot */
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
// The engine asks this before opening a sound mid-match: resident bytes or skip-and-fetch.
(globalThis as unknown as { __gxEnsure?: (big: string, offset: number, size: number) => number })
  .__gxEnsure = (big, offset, size) => streamer.ensure(big, offset, size);

// Chrome throttles window timers in hidden tabs down to once a minute, which freezes the main
// loop and desyncs LAN peers. Worker timers are exempt: while hidden, its tick drives frames
// through the engine's pump export. Single-player is already paused by then, so pumping it is
// harmless; a LAN match keeps simulating, which is the whole point.
const pumpWorker = new Worker(URL.createObjectURL(new Blob(
  ["setInterval(() => postMessage(0), 16);"], { type: "text/javascript" })));
pumpWorker.addEventListener("message", () => {
  if (!document.hidden) return;
  try {
    module?._GeneralsXPump?.();
  } catch {
    // Asyncify may be mid-unwind (emscripten_sleep); dropping the tick is the correct move.
  }
});
let lastManifest: { name: string; size: number; url: string; mount: string }[] | null = null;

/* -------------------------------------------------------------- guest sync */
// Served from another machine's link (https://<lan-ip>:8765): every archive byte crosses the
// network, and a mid-frame read there is heard as a stutter. Local files never stutter, so the
// full pull below only exists for guests.
// ?guest=1 forces the guest flow on localhost, for testing the sync screen without two machines.
const isGuest = query.get("guest") === "1"
  || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let guestBulk: { done: number; total: number; menuTotal: number; file: string; finished: boolean } | null = null;

/** The engine polls this inside the match load screen and keeps the game's own load screen
    (teams, factions, map) up while 1 — a match must not start before the sync lands. */
function setHoldMatch(hold: boolean): void {
  (globalThis as unknown as { __gxHoldMatch?: number }).__gxHoldMatch = hold ? 1 : 0;
}

const holo = el("holo");
let holoTimer: ReturnType<typeof setInterval> | undefined;

function holoShow(): void {
  if (!holo.hidden) return;
  holo.hidden = false;
  const ringFill = document.getElementById("holo-ring-fill") as unknown as SVGCircleElement;
  holoTimer = setInterval(() => {
    if (!guestBulk) return;
    // The ring covers the menu minimum only: it hits 100% exactly when Play appears.
    const scoped = Math.min(guestBulk.done, guestBulk.menuTotal);
    const ratio = guestBulk.menuTotal ? scoped / guestBulk.menuTotal : 0;
    el("holo-percent").textContent = `${Math.floor(ratio * 100)}%`;
    el("holo-mb").textContent = `${mb(scoped)}/${mb(guestBulk.menuTotal)} MB`;
    el("holo-file").textContent = guestBulk.file;
    ringFill.style.strokeDashoffset = String(339.292 * (1 - Math.min(1, ratio)));
  }, 250);
}

function holoHide(): void {
  if (holo.hidden) return;
  holo.hidden = true;
  clearInterval(holoTimer);
}

/** Guest download in two phases. Phase one pulls the menu minimum behind the hologram — Play
    only exists once the menu can actually open. Phase two pulls the rest (audio first) into the
    browser's disk cache behind the menu; until it lands, the engine keeps a match waiting on the
    game's own load screen. Returns when phase one is done. */
function guestPreload(entries: { name: string; size: number }[]): Promise<void> {
  const core = entries.filter((entry) => MENU_CORE.test(entry.name));
  const rest = sortedRest(entries);
  const coreTotal = core.reduce((sum, entry) => sum + entry.size, 0);
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  guestBulk = { done: 0, total, menuTotal: coreTotal, file: "contacting host…", finished: false };
  setHoldMatch(true);
  holoShow();
  const seen = (base: number) => (done: number, name: string): void => {
    if (!guestBulk) return;
    guestBulk.done = base + done;
    guestBulk.file = name;
    report("Downloading", `${name} · ${mb(base + done)}/${mb(total)} MB`, (base + done) / total);
  };
  const menuReady = streamer
    .warm(core as never, Number.MAX_SAFE_INTEGER, seen(0))
    .catch(() => {})
    .then(() => holoHide());
  void menuReady
    .then(() => streamer.prime(rest as never, seen(coreTotal)))
    .then(() => log("Full game synced from the host."))
    .catch(() => log("Guest sync stopped early — archives stream on demand instead."))
    .finally(() => {
      if (guestBulk) {
        guestBulk.done = guestBulk.total;
        guestBulk.finished = true;
      }
      setHoldMatch(false);
      report("", "");
    });
  return menuReady;
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

/** The menu minimum: what must be resident before the shell can open. Audio deliberately not
    here — sound rides the disk cache, because a tab that hoards the ~850 MB sound set in JS dies
    in a GC spiral once the engine heap lands on top (seen as "Running" over a black canvas). */
const MENU_CORE = /^(ini|window|english|gensec|patch)/i;

const mb = (bytes: number): string => (bytes / 2 ** 20).toFixed(0);

/** Download order for everything outside the menu core: a missing callout is the loudest failure,
    so sound first, textures and maps behind it. */
const matchRank = (name: string): number =>
  /^speech/i.test(name) ? 0 : /^audio/i.test(name) ? 1 : /^music/i.test(name) ? 2 : 3;

function sortedRest(entries: { name: string; size: number }[]): { name: string; size: number }[] {
  return entries
    .filter((entry) => !MENU_CORE.test(entry.name))
    .sort((a, b) => matchRank(a.name) - matchRank(b.name));
}

/** Everything local before Play: the menu core into memory, the rest — audio first — into the
    browser's disk cache. Nothing big stays in JS. */
function preloadEverything(entries: { name: string; size: number }[]): Promise<void> {
  const core = entries.filter((entry) => MENU_CORE.test(entry.name));
  const rest = sortedRest(entries);
  const coreTotal = core.reduce((sum, entry) => sum + entry.size, 0);
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  const seen = (base: number) => (done: number, name: string): void =>
    report("Downloading", `${name} · ${mb(base + done)}/${mb(total)} MB`, (base + done) / total);
  return streamer
    .warm(core as never, Number.MAX_SAFE_INTEGER, seen(0))
    .then(() => streamer.prime(rest as never, seen(coreTotal)))
    .then(() => {
      report("", "");
      log("All archives cached locally.");
    });
}
let module: EmscriptenModule | undefined;

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
      shell.holdEngine(instance);
      // ?assets=1 reopens the picker to point at a different install.
      if (query.pickInstall) {
        gate.show();
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
            gate.show();
            gate.setNote("Click to re-allow access to your game folder.");
            return; // dependency stays: booting now would mean booting with no archives
          }
          const manifest = await loadManifest();
          report("Mounting archives", `${manifest.entries.length} files`);
          if (manifest.missing) {
            gate.show();
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
          // Static hosting has no manifest server: ownership comes from the player's own folder.
          gate.show();
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
        // ?opt=Key=Val,Key2=Val2 forces Options.ini entries for this run — debugging tool.
        const optionOverrides = query.get("opt");
        if (optionOverrides) {
          let text = FS.readFile(optionsPath, { encoding: "utf8" });
          for (const pair of optionOverrides.split(",")) {
            const [key, value] = pair.split("=");
            if (!key || value === undefined) continue;
            const line = `${key} = ${value}`;
            const pattern = new RegExp(`^${key} = .*$`, "m");
            text = pattern.test(text) ? text.replace(pattern, line) : `${text}${line}\n`;
          }
          FS.writeFile(optionsPath, text);
        }
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
  el("frame").dataset.ready = "true";
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
  if (sound.muted) {
    // The export only answers once the engine's audio device exists, which is after this fires.
    const applySavedMute = setInterval(() => {
      if (module?._GeneralsXSetAudioMuted?.(1)) clearInterval(applySavedMute);
    }, 500);
  }
};

// A browser that cannot run the game must not pull a gigabyte to find that out — the gate is
// already up saying which requirement is missing.
if (!allSupported(shell.capabilities)) throw new Error("unsupported browser");

setStatus("Loading…");

// The emscripten build is produced by CMake and served beside this page, so it has to stay
// invisible to the bundler. A bare dynamic import is not: Vite resolves it at transform time and
// the dev server 500s outright when the engine has not been built, which is the normal state of a
// fresh checkout. rollupOptions.external only covers `build`, so it never helped here.
// Going through Function() makes it a plain runtime fetch Vite cannot see — same as Vice City.
const ENGINE_URL = "/GeneralsXZH.js";
const importEngine = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
const factory = await importEngine(ENGINE_URL)
  .then((loaded) => (loaded as { default: ModuleFactory }).default)
  .catch(() => undefined);

if (!factory) {
  report("Engine not built yet", "the GeneralsX WebAssembly build is not on this host");
  log("No /GeneralsXZH.js on this host — build the emscripten target and serve it beside this page.");
  gate.show();
  throw new Error("engine not built");
}

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
report("Ready", "Runtime downloaded, let's Skirmish");
play.addEventListener("click", () => {
  play.hidden = true;
  report("Starting engine", "loading game data");
  void factory(config);
  // The click is the user activation Chrome demands; sticky activation keeps later resumes legal.
  // Resume forever — Full Start creates its audio device long after the old 30-second settle
  // window closed, and the context then sat suspended and silent for the rest of the session.
  setInterval(resumeAudio, 1000);
}, { once: true });
