#!/bin/sh
# GeneralsX @build Codex 05/08/2026 Copy web artifacts where the launchd server can read them.
# macOS TCC blocks launchd agents from ~/Documents, so the always-on server serves this copy.
set -e
SRC="$(cd "$(dirname "$0")/../../.." && pwd)"
DEST="$HOME/Library/Application Support/GeneralsX/www"
mkdir -p "$DEST"
cp "$SRC/scripts/qa/smoke/serve-webgpu.py" "$HOME/Library/Application Support/GeneralsX/serve-webgpu.py"
# GeneralsX @feature Codex 06/08/2026 The page is a Vite + TypeScript app; only the game is wasm.
(cd "$SRC/web" && npm run build --silent)
rsync -a "$SRC/web/dist/" "$DEST/"
rsync -a \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.js" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.wasm" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.data" \
    "$DEST/"
# GeneralsX @feature Codex 05/08/2026 Expose the .big archives for streaming instead of packaging them.
ln -sfn "$HOME/GeneralsX/GeneralsZH" "$DEST/GeneralsZH"
ln -sfn "$HOME/GeneralsX/Generals" "$DEST/Generals"
# Browsable copy of the install for the folder picker (symlink, nothing duplicated).
mkdir -p "$DEST/assets"
ln -sfn "$HOME/GeneralsX" "$DEST/assets/generals"

launchctl kickstart -k "gui/$(id -u)/com.generalsx.serve" 2>/dev/null || true
echo "Deployed to $DEST"
