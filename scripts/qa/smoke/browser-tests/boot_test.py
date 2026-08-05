#!/usr/bin/env python3
"""Boot the deployed game in Chrome and verify it reaches Running with no fatal errors."""
import base64, sys, time
from lan_cdp import evaluate

PORT = 9243

def ev(expr, timeout=30):
    return evaluate(PORT, expr, timeout=timeout)

deadline = time.time() + 600
status = ""
while time.time() < deadline:
    try:
        status = ev("document.getElementById('status').textContent") or ""
        ready = ev("document.getElementById('canvas-shell').dataset.ready")
        print(f"status={status!r} ready={ready}", flush=True)
        if ready == "true" or "failed" in status.lower():
            break
    except Exception as error:
        print(f"probe: {type(error).__name__}", flush=True)
    time.sleep(10)

checks = {
    "status": status,
    "ready": ev("document.getElementById('canvas-shell').dataset.ready"),
    "canvas": ev("({w: document.getElementById('canvas').width, h: document.getElementById('canvas').height})"),
    "soundButton": ev("({header: !!document.getElementById('sound'), overlay: !!document.getElementById('sound-overlay'), label: document.getElementById('sound').textContent})"),
    "fullscreenOverlay": ev("!!document.getElementById('fullscreen-overlay')"),
    "memGuard": ev("window.generalsXBrowserMemoryStats"),
    "logErrors": ev("(document.getElementById('output').value.split('\\n').filter(l => /uncaught|unhandled|fatal|abort/i.test(l))).slice(0,5)"),
    "gameStatus": ev("window.generalsXConsole.execute('status')"),
}
for key, value in checks.items():
    print(f"{key}: {value}", flush=True)

data = ev("document.getElementById('canvas').toDataURL('image/png')", timeout=90)
with open("/tmp/generalsx-boot.png", "wb") as f:
    f.write(base64.b64decode(data.split(",", 1)[1]))
print("screenshot /tmp/generalsx-boot.png", flush=True)

ok = checks["ready"] == "true" and not checks["logErrors"]
print("BOOT:", "OK" if ok else "FAILED", flush=True)
sys.exit(0 if ok else 1)
