#!/usr/bin/env python3
"""Drive a 2-browser LAN match (1v1 + hard AI) until it ends."""
import base64, json, sys, time
from lan_cdp import evaluate

A, B = 9241, 9242
CON = "window.generalsXConsole.execute"


def run(port, command):
    value = evaluate(port, f"{CON}({json.dumps(command)})")
    print(f"[{port}] {command} -> {value}", flush=True)
    return value or ""


def lan_state(port):
    return evaluate(port, "Module._GeneralsXLanState ? Module._GeneralsXLanState() : -1")


def wait_for(label, predicate, timeout, interval=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if predicate():
                print(f"OK: {label}", flush=True)
                return True
        except Exception as error:
            print(f"wait {label}: {error}", flush=True)
        time.sleep(interval)
    print(f"TIMEOUT: {label}", flush=True)
    return False


def running(port):
    status = evaluate(port, f"{CON}('status')") or ""
    return "status=running" in status


assert wait_for("A running", lambda: running(A), 600, 10)
assert wait_for("B running", lambda: running(B), 600, 10)
time.sleep(10)

run(A, "lan open")
assert wait_for("A TheLAN", lambda: lan_state(A) & 1, 60)
run(A, "lan identity 1")
run(A, "lan host")
assert wait_for("A hosting", lambda: lan_state(A) & 4, 60)
assert "Map set" in run(A, "lan map 4")
time.sleep(2)

run(B, "lan open")
assert wait_for("B TheLAN", lambda: lan_state(B) & 1, 60)
run(B, "lan identity 2")
time.sleep(5)
assert wait_for("B joined", lambda: "requested" in run(B, "lan join") or lan_state(B) & 2, 90, 10)
assert wait_for("B in game", lambda: lan_state(B) & 2, 60)
time.sleep(3)

ai_slot = None
for slot in range(2, 8):
    if "hard AI" in run(A, f"lan ai {slot} hard"):
        ai_slot = slot
        break
print(f"AI slot: {ai_slot}", flush=True)
time.sleep(3)

started = False
for attempt in range(4):
    run(B, "lan accept")
    time.sleep(3)
    run(A, "lan start")
    if wait_for(f"match started (attempt {attempt + 1})",
                lambda: (lan_state(A) & 32) and (lan_state(B) & 32), 45, 5):
        started = True
        break
assert started
print("MATCH RUNNING", flush=True)

start = time.time()
result = "timeout"
while time.time() - start < 5400:
    time.sleep(30)
    try:
        state_a, state_b = lan_state(A), lan_state(B)
        frame_a = evaluate(A, "Module._GeneralsXLogicFrame()")
        frame_b = evaluate(B, "Module._GeneralsXLogicFrame()")
        end_a = evaluate(A, "Module._GeneralsXLanEndFrame()")
        crc_mismatch = (state_a | state_b) & 128
        print(f"stateA={state_a} stateB={state_b} frameA={frame_a} frameB={frame_b} "
              f"endA={end_a} crcMismatch={bool(crc_mismatch)}", flush=True)
        if crc_mismatch:
            result = "crc-mismatch"
            break
        if end_a:
            result = f"victory-at-frame-{end_a}"
            break
        if not (state_a & 32):
            result = "left-game"
            break
    except Exception as error:
        print(f"poll error: {error}", flush=True)

print(f"RESULT: {result}", flush=True)
for port, name in ((A, "lan-a"), (B, "lan-b")):
    try:
        data = evaluate(port, "document.getElementById('canvas').toDataURL('image/png')", timeout=60)
        with open(f"/tmp/generalsx-{name}.png", "wb") as f:
            f.write(base64.b64decode(data.split(",", 1)[1]))
        print(f"screenshot /tmp/generalsx-{name}.png", flush=True)
        print(f"[{port}] final: {run(port, 'lan status')}", flush=True)
    except Exception as error:
        print(f"screenshot {name}: {error}", flush=True)

sys.exit(0 if result.startswith("victory") else 1)
