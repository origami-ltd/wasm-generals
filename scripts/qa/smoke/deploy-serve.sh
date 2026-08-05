#!/bin/sh
# GeneralsX @build Codex 05/08/2026 Copy web artifacts where the launchd server can read them.
# macOS TCC blocks launchd agents from ~/Documents, so the always-on server serves this copy.
set -e
SRC="$(cd "$(dirname "$0")/../../.." && pwd)"
DEST="$HOME/Library/Application Support/GeneralsX/www"
mkdir -p "$DEST"
cp "$SRC/scripts/qa/smoke/serve-webgpu.py" "$HOME/Library/Application Support/GeneralsX/serve-webgpu.py"
rsync -a --delete \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.html" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.js" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.wasm" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXZH.data" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsXParity.sav" \
    "$SRC/build/webgpu/GeneralsMD/GeneralsReplays" \
    "$DEST/"
launchctl kickstart -k "gui/$(id -u)/com.generalsx.serve" 2>/dev/null || true
echo "Deployed to $DEST"
