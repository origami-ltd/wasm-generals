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
    "$DEST/"
# GeneralsX @feature Codex 05/08/2026 Expose the .big archives for streaming instead of packaging them.
ln -sfn "$HOME/GeneralsX/GeneralsZH" "$DEST/GeneralsZH"
ln -sfn "$HOME/GeneralsX/Generals" "$DEST/Generals"

launchctl kickstart -k "gui/$(id -u)/com.generalsx.serve" 2>/dev/null || true
echo "Deployed to $DEST"
