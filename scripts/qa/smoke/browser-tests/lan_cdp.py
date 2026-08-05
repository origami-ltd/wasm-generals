#!/usr/bin/env python3
"""Minimal CDP client: evaluate JS in the GeneralsXZH page of a Chrome debug port."""
import base64, hashlib, json, os, socket, struct, sys, time, urllib.request


def _recv_exact(sock, count):
    data = b""
    while len(data) < count:
        chunk = sock.recv(count - len(data))
        if not chunk:
            raise RuntimeError("closed")
        data += chunk
    return data


def _recv_frame(sock):
    first, second = _recv_exact(sock, 2)
    length = second & 127
    if length == 126:
        length = struct.unpack("!H", _recv_exact(sock, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", _recv_exact(sock, 8))[0]
    payload = _recv_exact(sock, length)
    return first & 15, payload


def _send_text(sock, payload):
    data = payload.encode()
    mask = os.urandom(4)
    length = len(data)
    if length < 126:
        header = bytes((0x81, 0x80 | length))
    elif length < 65536:
        header = bytes((0x81, 0x80 | 126)) + struct.pack("!H", length)
    else:
        header = bytes((0x81, 0x80 | 127)) + struct.pack("!Q", length)
    sock.sendall(header + mask + bytes(v ^ mask[i % 4] for i, v in enumerate(data)))


def cdp_call(port, method, params=None, timeout=30, url_filter="GeneralsXZH.html"):
    """Generic single CDP call against the matching page target."""
    return _call(port, method, params or {}, timeout, url_filter)


def evaluate(port, expression, timeout=30, url_filter="GeneralsXZH.html"):
    result = _call(port, "Runtime.evaluate",
                   {"expression": expression, "returnByValue": True, "awaitPromise": True},
                   timeout, url_filter)
    if result.get("exceptionDetails"):
        raise RuntimeError(json.dumps(result["exceptionDetails"])[:500])
    return result.get("result", {}).get("value")


def _call(port, method, params, timeout=30, url_filter="GeneralsXZH.html"):
    targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10))
    target = next(t for t in targets if t["type"] == "page" and url_filter in t["url"])
    url = target["webSocketDebuggerUrl"]
    path = "/" + url.split("/", 3)[3]
    sock = socket.create_connection(("127.0.0.1", port), timeout=timeout)
    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\n"
        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(request.encode())
    response = b""
    while b"\r\n\r\n" not in response:
        response += sock.recv(4096)
    if b" 101 " not in response.split(b"\r\n", 1)[0]:
        raise RuntimeError(response.decode(errors="replace"))
    _send_text(sock, json.dumps({"id": 1, "method": method, "params": params}))
    deadline = time.time() + timeout
    while time.time() < deadline:
        opcode, payload = _recv_frame(sock)
        if opcode != 1:
            continue
        message = json.loads(payload)
        if message.get("id") == 1:
            sock.close()
            if "error" in message:
                raise RuntimeError(json.dumps(message["error"])[:500])
            return message.get("result", {})
    raise TimeoutError("no CDP reply")


if __name__ == "__main__":
    print(json.dumps(evaluate(int(sys.argv[1]), sys.argv[2])))
