# WebAssembly and WebGPU Port

**Status**: Accepted development prototype
**Date**: 2026-08-04
**Primary domain**: Statera Studio
**Primary target**: GeneralsXZH

## Goal

Run the existing Zero Hour game code in Chrome as WebAssembly, render through WebGPU, preserve retail game data compatibility, and keep desktop backends unchanged.

## Architecture Decision

### Keep

- Shared game logic, replay behavior, asset formats, SDL3 input, and portable filesystem code.
- Direct3D 8-facing engine code behind its existing backend boundary.
- Current DirectX 8 and DXVK desktop paths.

### Change

- Add an Emscripten build target that emits HTML, JavaScript, and WebAssembly.
- Add a WebGPU implementation of the Direct3D 8 boundary using Emdawnwebgpu.
- Split the blocking desktop loop into a reusable frame step for browser scheduling.
- Load user-owned retail data through an explicit web asset input.

### Delete

- Nothing from existing desktop targets.

## Dependency Order and Gates

1. **Toolchain contract**
   - Emscripten compiler targets `wasm32`.
   - Emdawnwebgpu links successfully.
   - Chrome grants a WebGPU adapter and device.
2. **Build contract**
   - A `webgpu` CMake preset configures without DXVK, Vulkan, native OpenAL, FFmpeg, or desktop-only tools.
   - GeneralsXZH sources compile to WebAssembly.
3. **Renderer contract**
   - WebGPU backend creates a canvas surface and device.
   - Clear, vertex/index buffer, texture, depth, blend, transform, and draw paths have deterministic tests.
   - No unimplemented call needed by the main menu remains.
4. **Runtime contract**
   - Browser frame scheduling stays responsive.
   - SDL3 keyboard, mouse, resize, and focus events reach the existing input path.
   - Missing retail data produces one exact error; supplied data reaches the main menu.
5. **Frontend contract**
   - Starts only after gates 1-4 are green.
   - One shared responsive shell, English and Brazilian Portuguese complete, language selector visible, keyboard accessible, and reduced-motion safe.
6. **Acceptance**
   - Exact-head build loads in current Chrome.
   - WebAssembly module, hardware WebGPU device, main menu, and one skirmish map are live-proven.
   - Existing desktop configuration still succeeds.

## Browser Constraints

- Local development uses `http://127.0.0.1` or `http://localhost`, both accepted secure contexts for WebGPU.
- Threaded builds require COOP and COEP response headers.
- Retail assets remain local and untracked.
- WebGPU absence fails closed; WebGL is not a hidden fallback.

## Dribbble Inspiration Research

Selected references:

- [Game Launcher - Home](https://dribbble.com/shots/25178265-Game-Launcher-Home)
  - Form: one dominant launch surface with compact secondary controls.
  - Hierarchy: play readiness and current state precede library detail.
- [Atlas - Multi-Game Entertainment Platform](https://dribbble.com/shots/25918395-Atlas-Multi-Game-Entertainment-Platform-UI-UX-Design)
  - Form: responsive regions preserve the primary action across widths.
  - Hierarchy: setup and runtime status stay separate from optional content.

Only form and hierarchy transfer. Colors, typography, tokens, components, icons, motion, branding, assets, and design-system decisions do not transfer. The local Origami system remains the provisional frontend base.

## Accepted Evidence

- Emscripten 6.0.2 emits `GeneralsXZH.html`, `.js`, `.wasm`, and an explicit local `.data` package.
- Emdawnwebgpu creates the Chrome adapter, device, queue, and canvas surface without WebGL or DXVK.
- `WebGPUD3D8` supports the Direct3D 8 calls required by the main menu, Skirmish setup, render-to-texture map preview, HUD, terrain, structures, and units.
- `requestAnimationFrame` advances the existing deterministic frame step without blocking Chrome.
- SDL3 mouse input selects Solo, Skirmish, and Play Game.
- The exact release build entered Alpine Assault with a live minimap, `$10000`, structures, a dozer, and an advancing timer.
- The English and Brazilian Portuguese shell states were verified in current Chrome from one DOM and localization map.
- Runtime inspection found no page error, uncaptured WebGPU validation error, device loss, or adapter failure.

## Deferred Parity

- Audio and movie playback.
- Full fixed-function material, lighting, and terrain parity.
- Expansion-only model coverage beyond the selected local archive set.
- Legacy online services.
