# Chrome WebAssembly and WebGPU Runtime

## Status

The Zero Hour target builds as WebAssembly and runs a local skirmish in Chrome through the native WebGPU backend. This is an accepted development prototype, not a parity release.

## Requirements

- Chrome with WebGPU enabled.
- Emscripten with Emdawnwebgpu support. Acceptance used Emscripten 6.0.2.
- CMake, Ninja, and vcpkg with the `wasm32-emscripten` triplet.
- A legally owned local Generals and Zero Hour installation.
- A legally usable local TrueType font. The font and game data remain outside the repository.

## Configure

Set the Emscripten and vcpkg roots for the current shell:

```bash
export VCPKG_ROOT=/absolute/path/to/vcpkg
export EMSCRIPTEN_ROOT="$(brew --prefix emscripten)/libexec"
export EM_LLVM_ROOT="${EMSCRIPTEN_ROOT}/llvm/bin"
export EM_BINARYEN_ROOT="${EMSCRIPTEN_ROOT}/binaryen"
```

Configure the tested local asset set. `GENERALSX_WEB_ASSET_DIR` is searched first, then every directory in `GENERALSX_WEB_ASSET_DIRS`:

```bash
cmake --preset webgpu \
  -DGENERALSX_WEB_ASSET_DIR=/absolute/path/to/GeneralsZH \
  -DGENERALSX_WEB_ASSET_DIRS=/absolute/path/to/Generals \
  -DGENERALSX_WEB_FONT_FILE=/absolute/path/to/font.ttf \
  -DGENERALSX_WEB_PRELOAD_DIRS='Data/Cursors' \
  -DGENERALSX_WEB_ASSET_FILES='INIZH.big;English.big;EnglishZH.big;Textures.big;TexturesZH.big;WindowZH.big;PatchINI.big;PatchData.big;PatchWindow.big;PatchZH.big;gensecZH.big;ShadersZH.big;maps.big;MapsZH.big;Terrain.big;TerrainZH.big;W3D.big;W3DEnglishZH.big'
```

The build fails when any selected archive, preload directory, or font is missing. `Data/Cursors` supplies the native ANI cursors. Add `W3DZH.big` when testing content that requires expansion-specific models.

## Build and Run

```bash
cmake --build --preset webgpu --target z_generals
./scripts/qa/smoke/serve-webgpu.py build/webgpu/GeneralsMD --port 8765
```

Open `http://127.0.0.1:8765/GeneralsXZH.html` in Chrome.

The server sends `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, the WebAssembly MIME type, and no-store caching. The generated browser shell starts with `-noshellmap`, exposes English and Brazilian Portuguese controls, and keeps the game canvas as the primary surface.

## Developer Console

Press backtick to toggle the in-game developer console. It provides command history, Tab completion, and these commands:

```text
capture [frame]
clear
close
cursor free
frame <number>
fullscreen
help
language en|pt-BR
mute
reload
replay [path] [frame]
status
```

Automation can execute the same registry without mouse or keyboard synthesis:

```js
window.generalsXConsole.execute("frame 300");
```

Cursor capture is disabled by default. The browser runtime also writes every capture preference as `No` for deterministic parity runs.

## Architecture

- Emscripten owns WebAssembly generation and browser frame scheduling.
- SDL3 owns browser window, keyboard, and mouse delivery.
- Emdawnwebgpu owns adapter, device, queue, and canvas surface access.
- `WebGPUD3D8` implements the existing Direct3D 8 boundary without DXVK, Vulkan, WebGL, or JavaScript rendering fallbacks.
- Legacy game logic and deterministic GameMath remain shared with desktop builds.
- Selected local archives and the local font are packaged into the generated `.data` artifact only. They are not source files and must never be committed.

### Proton WASM Assessment

The local Proton WASM checkout was inspected for reusable browser networking. It provides an experimental `wasm32` Wine loader and BoxedWine's generated Emscripten socket layer, but no GameSpy-to-WebSocket transport or browser relay contract. GeneralsX therefore keeps its direct source port and does not import that runtime. GameSpy requires a separately specified and accepted browser transport before it can be enabled.

## Accepted Runtime Evidence

Acceptance on 4 August 2026 used current Chrome and the exact release build from branch `codex/webgpu-wasm`:

- WebAssembly module loaded and WebGPU created a live canvas device.
- Main menu, Solo, and Skirmish setup rendered.
- Alpine Assault map preview loaded from 169 cached map records.
- A local skirmish rendered terrain, structures, a dozer, HUD, minimap, `$10000`, and an advancing game timer.
- Mouse input selected menus and launched the skirmish.
- English and Brazilian Portuguese browser controls switched from one shared DOM tree.
- No page error, uncaptured WebGPU validation error, device loss, or adapter failure occurred.

## Current Limits

- The tested archive preload is about 930 MB and the WebAssembly runtime reserves a 2 GiB initial heap.
- Audio uses the explicit null backend. Movies use the existing non-Windows stub.
- GameSpy and legacy online services are disabled.
- The fixed-function WebGPU facade is sufficient for the accepted game path but is not renderer parity. Some terrain, lighting, material, and expansion-model paths remain incomplete.
- The browser shell is fully localized in English and Brazilian Portuguese. In-game language still follows the user-supplied retail language archives.
