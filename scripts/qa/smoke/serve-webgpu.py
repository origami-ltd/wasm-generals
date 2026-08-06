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
import socket
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

TLS_PORT = 8765  # the listener started with --cert; the plain one is only for local convenience
CONFIG_DIR = Path.home() / "Library" / "Application Support" / "GeneralsX"

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
        if path == "/GeneralsXShare":
            # LAN invite: the address other machines on this network use to reach this host.
            probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                probe.connect(("192.0.2.1", 80))  # never sent; just picks the outbound interface
                address = probe.getsockname()[0]
            except OSError:
                address = "127.0.0.1"
            finally:
                probe.close()
            # Always hand out https: guests need a secure context for SharedArrayBuffer, so the plain
            # listener would give them a page that can never stream.
            body = json.dumps({"url": f"https://{address}:{TLS_PORT}/"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/GeneralsXAssets":
            self.send_asset_manifest()
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
    GAME_PATHS_FILE = CONFIG_DIR / "game_paths.txt"

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
        # Handshake lazily in the worker thread: wrapping the listening socket eagerly makes accept()
        # perform the handshake, so one slow client blocks every new connection.
        server.socket = context.wrap_socket(server.socket, server_side=True,
                                            do_handshake_on_connect=False)
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
