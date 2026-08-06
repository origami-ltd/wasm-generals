[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/fbraz3/GeneralsGameCode)
[![GeneralsX CI](https://github.com/fbraz3/GeneralsX/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fbraz3/GeneralsX/actions/workflows/ci.yml)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-ebellumat-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/ebellumat)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE.md)

# GeneralsX Web — Command & Conquer: Generals Zero Hour in the browser

**Play it: [generals.wasm.com.br](https://generals.wasm.com.br)** — bring your own installed copy of the game.
The release *is* the site; there is nothing to download.

## The wasm.com.br initiative

**wasm.com.br** is a preservation and portability initiative for games that have already been
decompiled or had their source released. Once a game's code exists again, it deserves to run on
the one platform that needs no installer, no emulator setup and no operating system loyalty:
the browser.

- **Command & Conquer: Generals Zero Hour** (this repository) is the proof of concept — the full
  game compiled to WebAssembly, rendering through WebGPU, with LAN multiplayer working
  browser-to-browser.
- **PROTON + WINE have also been ported to WebAssembly**, extending the initiative beyond
  source-available games — **Dino Crisis (GOG) is already playable** through it.
- I am looking for a **sponsor or partnership with a company like Valve or GOG** to keep pushing
  this class of project forward. If that's you: [lbj.erasmo@gmail.com](mailto:lbj.erasmo@gmail.com).

## Building from source

Everything is WebAssembly, so the whole build fits here:

```bash
# toolchain (macOS): emscripten + ninja + cmake, plus a vcpkg checkout
brew install emscripten ninja cmake
git clone https://github.com/microsoft/vcpkg ~/vcpkg && ~/vcpkg/bootstrap-vcpkg.sh

# engine → GeneralsXZH.{js,wasm,data}
export EMSCRIPTEN_ROOT=/opt/homebrew/Cellar/emscripten/6.0.2/libexec
export EM_LLVM_ROOT=$EMSCRIPTEN_ROOT/llvm/bin
export EM_BINARYEN_ROOT=$EMSCRIPTEN_ROOT/binaryen
VCPKG_ROOT=~/vcpkg cmake --preset webgpu
VCPKG_ROOT=~/vcpkg ninja -C build/webgpu z_generals

# page (TypeScript + Tailwind)
cd web && npm install && npm run build

# serve it all locally (TLS + HTTP listeners, asset streaming, LAN relay)
bash scripts/qa/smoke/deploy-serve.sh
```

Requirements to play: a WebGPU browser (Chrome or Edge), your own installation of Generals
Zero Hour, and HTTPS — SharedArrayBuffer demands a secure context (`localhost` is exempt).

## Project goals

I am building a **reusable WebAssembly base shared across projects** — the streaming asset
layer, the synchronous worker + SharedArrayBuffer file bridge, the WebGPU Direct3D translation,
the browser LAN relay — so that each new preserved game starts from a working foundation
instead of from zero.

## What this runs

The complete Zero Hour game compiled with Emscripten, no features cut:

- **WebGPU rendering** through a Direct3D 8 translation layer
- **Streaming assets** — the game's `.big` archives are read on demand; nothing is repackaged
  into the binary
- **Your copy, your files** — no game data is distributed. On first run you point the page at
  your installed copy (Steam / EA app / disc) and the archives are read straight from your disk
- **LAN multiplayer** over a WebSocket relay, with a shareable link for players on your network
- **The game's own load screens, pause menu and credits** — ESC opens the original pause menu
- A native macOS build (MoltenVK) from the same tree, used as the behavioral reference

## 🤝 How to Contribute

1. Check [current issues](https://github.com/origami-ltd/wasm-generals/issues) and open a discussion
2. Build from source with the steps above
3. Submit issues or pull requests with detailed information

## 💖 Support This Project

- **[Buy me a coffee](https://buymeacoffee.com/ebellumat)** — supports the wasm.com.br initiative
- **[Sponsor on GitHub](https://github.com/sponsors/fbraz3)** — supports GeneralsX, the base this port stands on

## 📄 License

**GPL-3.0**, inherited from the [GeneralsX](https://github.com/fbraz3/GeneralsX) base and EA's
official source release of Generals ([LICENSE.md](LICENSE.md)). Author's note: I would rather
ship this MIT, but I can't override such an archaic license.

EA has not endorsed and does not support this product. All trademarks are the property of their
respective owners.

## 🙏 Special Thanks

- **[fbraz3](https://github.com/fbraz3)** for [GeneralsX](https://github.com/fbraz3/GeneralsX),
  the cross-platform base this port is built on
- **[Westwood Studios](https://cnc-comm.com/westwood-studios)** for creating the legendary Command & Conquer series
- **[EA Games](https://www.ea.com/)** for Command & Conquer: Generals, which continues to inspire gaming communities
- **[TheSuperHackers / Xezon](https://github.com/TheSuperHackers/GeneralsGameCode)** and contributors for the upstream stability, bug fixes, and code modernization
- **[Fighter19](https://github.com/Fighter19)** for the cross-platform port that pioneered SDL3 windowing, DXVK graphics, and MinGW build support on Linux
- **[feliwir](https://github.com/feliwir)** for the foundational cross-platform systems: OpenAL audio, FFmpeg video decoding, C++17 filesystem, and Freetype/Fontconfig text rendering
- **All contributors and sponsors** for helping make this game truly cross-platform and accessible worldwide

---

A project by [Origami LTD](https://origami.ltd) (限) · part of **wasm.com.br** ·
WebAssembly port by **Erasmo "ebellumat" Bellumat** — [github.com/ebellumat](https://github.com/ebellumat)
