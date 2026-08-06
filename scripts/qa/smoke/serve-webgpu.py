#!/usr/bin/env python3
"""Serve Emscripten artifacts with the headers required by shared WebAssembly memory.

Usage:
    ./scripts/qa/smoke/serve-webgpu.py DIRECTORY [--port PORT]
"""

import argparse
import base64
import functools
import hashlib
import hashlib
import hmac
import json
import os
import re
import secrets
import struct
import time
import urllib.parse
import urllib.request
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class LanRelay:
    """Route browser WebSocket datagrams by virtual IPv4 address and port."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._clients: dict[tuple[int, int], "WebGPURequestHandler"] = {}
        self._registrations = 0
        self._broadcasts = 0
        self._directed = 0
        self._delivered = 0

    def register(self, key: tuple[int, int], client: "WebGPURequestHandler") -> None:
        with self._lock:
            self._clients[key] = client
            self._registrations += 1

    def unregister(self, client: "WebGPURequestHandler") -> None:
        with self._lock:
            stale = [key for key, value in self._clients.items() if value is client]
            for key in stale:
                del self._clients[key]

    def route(self, source: tuple[int, int], destination: tuple[int, int], payload: bytes) -> None:
        with self._lock:
            if destination[0] == 0xFFFFFFFF:
                self._broadcasts += 1
                targets = [
                    client
                    for key, client in self._clients.items()
                    if key[1] == destination[1] and key != source
                ]
            else:
                self._directed += 1
                target = self._clients.get(destination)
                targets = [target] if target is not None else []
            self._delivered += len(targets)

        message = bytes((2,)) + struct.pack("!IH", source[0], source[1]) + payload
        for target in targets:
            try:
                target.send_websocket_frame(2, message)
            except OSError:
                self.unregister(target)

    def status(self) -> dict[str, object]:
        with self._lock:
            clients = [
                {"ip": ".".join(str((ip >> shift) & 0xFF) for shift in (24, 16, 8, 0)), "port": port}
                for ip, port in sorted(self._clients)
            ]
            return {
                "clients": clients,
                "registrations": self._registrations,
                "broadcasts": self._broadcasts,
                "directed": self._directed,
                "delivered": self._delivered,
            }


LAN_RELAY = LanRelay()

# GeneralsX @feature Codex 06/08/2026 Steam ownership gate. Players sign in through Steam OpenID; with a
# Steam Web API key configured we verify they own the game before serving it. Config lives next to the
# server data: steam_api_key.txt (enables the gate), steam_app_ids.txt (comma-separated, optional).
STEAM_DIR = Path.home() / "Library" / "Application Support" / "GeneralsX"
STEAM_KEY_FILE = STEAM_DIR / "steam_api_key.txt"
STEAM_APPS_FILE = STEAM_DIR / "steam_app_ids.txt"
STEAM_SECRET_FILE = STEAM_DIR / "session_secret"
STEAM_OPENID = "https://steamcommunity.com/openid/login"
# Default: Command & Conquer Generals / Zero Hour Steam releases; adjust steam_app_ids.txt if needed.
STEAM_DEFAULT_APPS = "2229880,2732960"
STEAM_SESSION_SECONDS = 7 * 24 * 3600


def steam_api_key():
    try:
        return STEAM_KEY_FILE.read_text().strip() or None
    except OSError:
        return None


def steam_gate_enabled():
    return steam_api_key() is not None


def steam_app_ids():
    try:
        raw = STEAM_APPS_FILE.read_text().strip()
    except OSError:
        raw = ""
    return [int(x) for x in (raw or STEAM_DEFAULT_APPS).split(",") if x.strip().isdigit()]


def steam_secret():
    try:
        return STEAM_SECRET_FILE.read_bytes()
    except OSError:
        secret = secrets.token_bytes(32)
        STEAM_DIR.mkdir(parents=True, exist_ok=True)
        STEAM_SECRET_FILE.write_bytes(secret)
        return secret


def steam_sign(payload: str) -> str:
    return hmac.new(steam_secret(), payload.encode(), hashlib.sha256).hexdigest()


def steam_make_cookie(steamid: str, owns: bool, name: str) -> str:
    expires = str(int(time.time()) + STEAM_SESSION_SECONDS)
    name_b64 = base64.urlsafe_b64encode(name.encode()).decode()
    payload = f"{steamid}.{1 if owns else 0}.{expires}.{name_b64}"
    return f"{payload}.{steam_sign(payload)}"


def steam_read_cookie(header: str):
    for part in (header or "").split(";"):
        key, _, value = part.strip().partition("=")
        if key != "gxsteam":
            continue
        pieces = value.rsplit(".", 1)
        if len(pieces) != 2 or not hmac.compare_digest(steam_sign(pieces[0]), pieces[1]):
            return None
        steamid, owns, expires, name_b64 = pieces[0].split(".")
        if int(expires) < time.time():
            return None
        name = base64.urlsafe_b64decode(name_b64.encode()).decode()
        return {"steamid": steamid, "owns": owns == "1", "name": name}
    return None


def steam_check_ownership(steamid: str):
    key = steam_api_key()
    if not key:
        return False, "Steam API key not configured on the server."
    try:
        url = ("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?" +
               urllib.parse.urlencode({"key": key, "steamid": steamid, "format": "json",
                                       "include_played_free_games": 1}))
        with urllib.request.urlopen(url, timeout=15) as response:
            games = json.load(response).get("response", {}).get("games", []) or []
        owned = {g.get("appid") for g in games}
        if owned & set(steam_app_ids()):
            return True, ""
        if not games:
            return False, "Steam profile is private: make Game Details public and sign in again."
        return False, "This Steam account does not own the game."
    except Exception as error:  # noqa: BLE001 - report any API failure to the player
        return False, f"Steam API error: {error}"


def steam_player_name(steamid: str) -> str:
    key = steam_api_key()
    if not key:
        return ""
    try:
        url = ("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?" +
               urllib.parse.urlencode({"key": key, "steamids": steamid}))
        with urllib.request.urlopen(url, timeout=10) as response:
            players = json.load(response).get("response", {}).get("players", [])
        return players[0].get("personaname", "") if players else ""
    except Exception:  # noqa: BLE001
        return ""



# GeneralsX @build Codex 04/08/2026 Provide deterministic local browser isolation.
class WebGPURequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
    }

    def setup(self) -> None:
        super().setup()
        self._websocket_send_lock = threading.Lock()

    # GeneralsX @feature Codex 05/08/2026 Persist browser runtime logs so tab crashes leave evidence.
    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path != "/GeneralsXLog":
            self.send_error(404)
            return
        length = min(int(self.headers.get("Content-Length", 0) or 0), 4 * 1024 * 1024)
        body = self.rfile.read(length)
        log_dir = Path.home() / "Library" / "Logs" / "GeneralsX"
        log_dir.mkdir(parents=True, exist_ok=True)
        client = self.client_address[0].replace(":", "_")
        with open(log_dir / f"{client}.log", "ab") as handle:
            handle.write(body)
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    CRASH_PAGE = b"""<!doctype html><meta charset="utf-8"><title>GeneralsX crashed</title>
<body style="background:#111315;color:#f4f1e8;font-family:system-ui;padding:40px;max-width:900px;margin:auto">
<h1 style="color:#e1a94b">GeneralsX hit the memory guard</h1>
<p>The runtime log below was saved before the page was torn down. A copy is also on the
server at <code>~/Library/Logs/GeneralsX/</code>.</p>
<p><a style="color:#e1a94b" href="/GeneralsXZH.html">Reload the game</a></p>
<pre id="log" style="background:#000;padding:16px;overflow:auto;max-height:70vh;white-space:pre-wrap"></pre>
<script>
document.getElementById("log").textContent =
    (localStorage.getItem("generalsX.lastCrashAt") || "") + "\\n" +
    (localStorage.getItem("generalsX.lastCrashLog") || "No saved log found.");
</script>"""

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/GeneralsXCrash":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(self.CRASH_PAGE)))
            self.end_headers()
            self.wfile.write(self.CRASH_PAGE)
            return
        if path == "/GeneralsXLan" and self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_lan_websocket()
            return
        if path == "/GeneralsXSteamSession":
            session = steam_read_cookie(self.headers.get("Cookie", ""))
            payload = {"gate": steam_gate_enabled(), "authenticated": session is not None,
                       "owns": bool(session and session["owns"]),
                       "name": session["name"] if session else ""}
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/GeneralsXSteamLogin":
            host = self.headers.get("Host", "localhost:8765")
            return_to = f"https://{host}/GeneralsXSteamReturn"
            query = urllib.parse.urlencode({
                "openid.ns": "http://specs.openid.net/auth/2.0",
                "openid.mode": "checkid_setup",
                "openid.return_to": return_to,
                "openid.realm": f"https://{host}/",
                "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
                "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
            })
            self.send_response(302)
            self.send_header("Location", f"{STEAM_OPENID}?{query}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path == "/GeneralsXSteamReturn":
            params = dict(urllib.parse.parse_qsl(urlsplit(self.path).query))
            params["openid.mode"] = "check_authentication"
            verify = urllib.request.Request(STEAM_OPENID, urllib.parse.urlencode(params).encode())
            try:
                with urllib.request.urlopen(verify, timeout=15) as response:
                    valid = b"is_valid:true" in response.read()
            except Exception:  # noqa: BLE001
                valid = False
            claimed = params.get("openid.claimed_id", "")
            steamid = claimed.rsplit("/", 1)[-1] if valid and claimed.rsplit("/", 1)[-1].isdigit() else None
            # Popup flow: the window closes itself and tells the opener to re-check the session.
            body = (b"<!doctype html><meta charset=utf-8><title>Steam</title>"
                    b"<body style='background:#04080c;color:#7fe7ff;font:14px monospace;padding:24px'>"
                    b"Signed in. You can close this window."
                    b"<script>opener&&opener.postMessage('gx-steam-done','*');close()</script>")
            self.send_response(200)
            if steamid:
                owns, reason = steam_check_ownership(steamid)
                name = steam_player_name(steamid)
                cookie = steam_make_cookie(steamid, owns, name)
                self.send_header("Set-Cookie",
                                 f"gxsteam={cookie}; Path=/; Max-Age={STEAM_SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax")
                if not owns:
                    print(f"Steam login {steamid}: ownership denied ({reason})")
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/GeneralsXAssets":
            self.send_asset_manifest()
            return
        # No proof, no game data: with the gate on, archives and the wasm bundle need a valid owning session.
        if steam_gate_enabled() and (path.endswith(".big") or path.endswith(".data") or path.endswith(".wasm")):
            session = steam_read_cookie(self.headers.get("Cookie", ""))
            if not (session and session["owns"]):
                self.send_error(403, "Steam ownership required")
                return
        if path.endswith(".big"):
            self._cacheable = True
        range_header = self.headers.get("Range")
        if range_header and self.send_range(range_header):
            return
        if path == "/GeneralsXLanStatus":
            payload = json.dumps(LAN_RELAY.status(), separators=(",", ":")).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Accept-Ranges", "bytes")
        # GeneralsX @feature Codex 05/08/2026 Game archives are streamed in ranges and never change during a
        # session, so they must stay cacheable; no-store here would refetch every chunk the engine reads.
        if getattr(self, "_cacheable", False):
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # GeneralsX @feature Codex 06/08/2026 First-run: game archives come from the player's own install.
    # Default location is ~/GeneralsX/{Generals,GeneralsZH}; custom paths (e.g. a Steam install) go in
    # game_paths.txt next to the server data, one KEY=path per line: GENERALS=... / ZEROHOUR=...
    GAME_PATHS_FILE = STEAM_DIR / "game_paths.txt"

    def resolve_game_dirs(self) -> None:
        root = Path(self.directory)
        configured = {}
        try:
            for line in self.GAME_PATHS_FILE.read_text().splitlines():
                key, _, value = line.partition("=")
                if key.strip() in ("GENERALS", "ZEROHOUR") and value.strip():
                    configured[key.strip()] = Path(value.strip()).expanduser()
        except OSError:
            pass
        defaults = {"GENERALS": Path.home() / "GeneralsX" / "Generals",
                    "ZEROHOUR": Path.home() / "GeneralsX" / "GeneralsZH"}
        mounts = {"GENERALS": "Generals", "ZEROHOUR": "GeneralsZH"}
        for key, mount in mounts.items():
            link = root / mount
            target = configured.get(key, defaults[key])
            if not any(link.glob("*.big")) and target.is_dir() and any(target.glob("*.big")):
                if link.is_symlink() or link.exists():
                    try:
                        link.unlink()
                    except OSError:
                        continue
                link.symlink_to(target)

    def send_asset_manifest(self) -> None:
        self.resolve_game_dirs()
        root = Path(self.directory)
        entries = []
        for mount in ("GeneralsZH", "Generals"):
            directory = root / mount
            if not directory.is_dir():
                continue
            for archive in sorted(directory.glob("*.big")):
                entries.append({
                    "mount": f"/{mount}",
                    "name": archive.name,
                    "url": f"/{mount}/{archive.name}",
                    "size": archive.stat().st_size,
                })
        payload = json.dumps({
            "entries": entries,
            "missing": not any(e["mount"] == "/GeneralsZH" for e in entries),
            "defaultPath": str(Path.home() / "GeneralsX"),
            "configPath": str(self.GAME_PATHS_FILE),
        }, separators=(",", ":")).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    # GeneralsX @feature Codex 05/08/2026 Range support lets the browser stream .big archives on demand
    # instead of the build packaging every byte into one preloaded blob held in memory.
    def send_range(self, range_header: str) -> bool:
        fs_path = Path(self.translate_path(self.path))
        if not fs_path.is_file():
            return False
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match:
            return False

        size = fs_path.stat().st_size
        start_text, end_text = match.groups()
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
        elif end_text:  # suffix range: last N bytes
            start = max(0, size - int(end_text))
            end = size - 1
        else:
            return False

        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True

        end = min(end, size - 1)
        length = end - start + 1
        self._cacheable = True
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(fs_path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        with open(fs_path, "rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(1 << 20, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        return True

    def handle_lan_websocket(self) -> None:
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400, "Missing Sec-WebSocket-Key")
            return

        accept = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
        ).decode("ascii")
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        self.wfile.flush()

        source: tuple[int, int] | None = None
        try:
            while True:
                opcode, payload = self.read_websocket_frame()
                if opcode == 8:
                    break
                if opcode == 9:
                    self.send_websocket_frame(10, payload)
                    continue
                if opcode != 2 or not payload:
                    continue
                if payload[0] == 1 and len(payload) == 7:
                    source = struct.unpack("!IH", payload[1:])
                    LAN_RELAY.register(source, self)
                elif payload[0] == 2 and source is not None and len(payload) >= 7:
                    destination = struct.unpack("!IH", payload[1:7])
                    LAN_RELAY.route(source, destination, payload[7:])
        except (ConnectionError, OSError, ValueError):
            pass
        finally:
            LAN_RELAY.unregister(self)

    def read_websocket_frame(self) -> tuple[int, bytes]:
        header = self.rfile.read(2)
        if len(header) != 2:
            raise ConnectionError("WebSocket closed")
        opcode = header[0] & 0x0F
        masked = bool(header[1] & 0x80)
        length = header[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._read_exact(8))[0]
        if length > 65535:
            raise ValueError("WebSocket frame too large")
        mask = self._read_exact(4) if masked else b""
        payload = self._read_exact(length)
        if masked:
            payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        return opcode, payload

    def send_websocket_frame(self, opcode: int, payload: bytes) -> None:
        if len(payload) < 126:
            header = bytes((0x80 | opcode, len(payload)))
        else:
            header = bytes((0x80 | opcode, 126)) + struct.pack("!H", len(payload))
        with self._websocket_send_lock:
            self.connection.sendall(header + payload)

    def _read_exact(self, length: int) -> bytes:
        data = bytearray()
        while len(data) < length:
            chunk = self.rfile.read(length - len(data))
            if not chunk:
                raise ConnectionError("WebSocket closed")
            data.extend(chunk)
        return bytes(data)


def main() -> int:
    """Serve one artifact directory."""
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--bind", default="127.0.0.1")
    # GeneralsX @feature Codex 05/08/2026 TLS keeps WebGPU/SharedArrayBuffer secure-context over LAN IPs.
    parser.add_argument("--cert", type=Path)
    parser.add_argument("--key", type=Path)
    args = parser.parse_args()

    directory = args.directory.resolve()
    if not directory.is_dir():
        parser.error(f"directory does not exist: {directory}")

    handler = functools.partial(WebGPURequestHandler, directory=str(directory))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    scheme = "http"
    if args.cert:
        import ssl

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    print(f"Serving {directory} at {scheme}://{args.bind}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
