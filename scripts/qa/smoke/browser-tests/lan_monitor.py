#!/usr/bin/env python3
"""Poll the running LAN match until it ends, then capture evidence."""
import base64, sys, time
from lan_cdp import evaluate

A, B = 9241, 9242
start = time.time()
result = "timeout"
while time.time() - start < 7200:
    time.sleep(30)
    try:
        state_a = evaluate(A, "Module._GeneralsXLanState()", timeout=90)
        state_b = evaluate(B, "Module._GeneralsXLanState()", timeout=90)
        frame_a = evaluate(A, "Module._GeneralsXLogicFrame()", timeout=90)
        frame_b = evaluate(B, "Module._GeneralsXLogicFrame()", timeout=90)
        end_a = evaluate(A, "Module._GeneralsXLanEndFrame()", timeout=90)
        print(f"stateA={state_a} stateB={state_b} frameA={frame_a} frameB={frame_b} endA={end_a}", flush=True)
        if (state_a | state_b) & 128:
            result = "crc-mismatch"
            break
        if end_a:
            result = f"victory-at-frame-{end_a}"
            break
        if not (state_a & 32):
            result = f"left-game-at-frame-{frame_a}"
            break
    except Exception as error:
        print(f"poll error: {type(error).__name__}: {error}", flush=True)

print(f"RESULT: {result}", flush=True)
for port, name in ((A, "lan-a"), (B, "lan-b")):
    try:
        data = evaluate(port, "document.getElementById('canvas').toDataURL('image/png')", timeout=120)
        with open(f"/tmp/generalsx-{name}.png", "wb") as f:
            f.write(base64.b64decode(data.split(",", 1)[1]))
        print(f"screenshot /tmp/generalsx-{name}.png", flush=True)
        print(f"[{port}] {evaluate(port, 'window.generalsXConsole.execute(\"lan status\")', timeout=60)}", flush=True)
    except Exception as error:
        print(f"evidence {name}: {type(error).__name__}: {error}", flush=True)

sys.exit(0 if result.startswith("victory") else 1)
