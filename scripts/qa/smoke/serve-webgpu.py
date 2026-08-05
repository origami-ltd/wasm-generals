#!/usr/bin/env python3
"""Serve Emscripten artifacts with the headers required by shared WebAssembly memory.

Usage:
    ./scripts/qa/smoke/serve-webgpu.py DIRECTORY [--port PORT]
"""

import argparse
import base64
import functools
import hashlib
import json
import struct
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
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

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
