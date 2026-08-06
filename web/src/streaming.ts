/**
 * Game archives are streamed on demand instead of being packaged into the wasm bundle.
 *
 * The engine reads archives with plain synchronous file reads, and neither browser escape hatch works
 * here: synchronous XHR is banned on the main thread, and Asyncify cannot unwind through the invoke_*
 * JS frames the engine's try/catch scopes create. So reads really are synchronous — a worker fetches
 * 4 MiB chunks into a SharedArrayBuffer while the main thread spin-waits — with an LRU keeping the
 * engine's many small reads off the network.
 */
import type { EmscriptenFS, EmscriptenModule } from "./types";

const CHUNK_SIZE = 4 * 1024 * 1024;
const CACHE_LIMIT = 192 * 1024 * 1024;

export interface ArchiveEntry {
  mount: string;
  name: string;
  url: string;
  size: number;
}

export interface AssetManifest {
  entries: ArchiveEntry[];
  missing: boolean;
  defaultPath: string;
  configPath: string;
}

const workerSource = `
  postMessage("ready");
  onmessage = async (event) => {
    const { url, start, end, sab } = event.data;
    const state = new Int32Array(sab, 0, 2);
    const data = new Uint8Array(sab, 8);
    try {
      const response = await fetch(url, { headers: { Range: "bytes=" + start + "-" + end } });
      if (!response.ok && response.status !== 206) throw new Error("HTTP " + response.status);
      const bytes = new Uint8Array(await response.arrayBuffer());
      data.set(bytes.subarray(0, data.length));
      state[1] = Math.min(bytes.length, data.length);
      Atomics.store(state, 0, 1);
    } catch {
      state[1] = 0;
      Atomics.store(state, 0, 2);
    }
  };`;

export class ArchiveStreamer {
  private readonly cache = new Map<string, Uint8Array>();
  private worker: Worker | null = null;
  private buffer: SharedArrayBuffer | null = null;
  /** Resolves once the worker is alive. It must be running before the engine ever spin-waits:
      the main thread never yields afterwards, so a worker started later could never boot. */
  readonly ready: Promise<unknown>;

  constructor(private readonly onError: (message: string) => void) {
    if (!crossOriginIsolated) {
      this.ready = Promise.resolve();
      return;
    }
    this.worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));
    this.buffer = new SharedArrayBuffer(CHUNK_SIZE + 8);
    this.ready = new Promise((resolve) => this.worker?.addEventListener("message", resolve, { once: true }));
  }

  private fetchChunkSync(url: string, index: number): Uint8Array {
    if (!this.worker || !this.buffer) {
      this.onError("SharedArrayBuffer unavailable: archives cannot stream.");
      return new Uint8Array(0);
    }
    const state = new Int32Array(this.buffer, 0, 2);
    Atomics.store(state, 0, 0);
    const start = index * CHUNK_SIZE;
    this.worker.postMessage({
      url: new URL(url, location.href).href,
      start,
      end: start + CHUNK_SIZE - 1,
      sab: this.buffer,
    });
    const deadline = Date.now() + 60_000;
    while (Atomics.load(state, 0) === 0) {
      if (Date.now() > deadline) {
        this.onError(`Archive fetch timed out: ${url} chunk ${index}`);
        return new Uint8Array(0);
      }
    }
    if (Atomics.load(state, 0) !== 1) {
      this.onError(`Archive fetch failed: ${url} chunk ${index}`);
      return new Uint8Array(0);
    }
    return new Uint8Array(this.buffer.slice(8, 8 + (state[1] ?? 0)));
  }

  private takeChunk(url: string, index: number): Uint8Array {
    const key = `${url}#${index}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key); // re-insert to mark most recently used
      this.cache.set(key, cached);
      return cached;
    }
    const chunk = this.fetchChunkSync(url, index);
    this.cache.set(key, chunk);
    let total = 0;
    for (const value of this.cache.values()) total += value.length;
    while (total > CACHE_LIMIT && this.cache.size > 1) {
      const oldest = this.cache.keys().next().value as string;
      total -= this.cache.get(oldest)?.length ?? 0;
      this.cache.delete(oldest);
    }
    return chunk;
  }

  mount(module: EmscriptenModule, entry: ArchiveEntry): void {
    const FS = module.FS as EmscriptenFS;
    FS.mkdirTree(entry.mount);
    const node = FS.createFile(entry.mount, entry.name, {}, true, false);
    const size = entry.size;
    Object.defineProperty(node, "usedBytes", { get: () => size });
    node.stream_ops = {
      llseek: (stream, offset, whence) => {
        let position = offset;
        if (whence === 1) position += stream.position;
        else if (whence === 2) position = size + offset;
        if (position < 0) throw new FS.ErrnoError(28);
        return position;
      },
      read: (_stream, buffer, offset, length, position) => {
        const end = Math.min(size, position + length);
        if (position >= end) return 0;
        const firstChunk = Math.floor(position / CHUNK_SIZE);
        const lastChunk = Math.floor((end - 1) / CHUNK_SIZE);
        let written = 0;
        for (let index = firstChunk; index <= lastChunk; index += 1) {
          const chunk = this.takeChunk(entry.url, index);
          const chunkStart = index * CHUNK_SIZE;
          const from = Math.max(position, chunkStart) - chunkStart;
          const to = Math.min(end, chunkStart + chunk.length) - chunkStart;
          if (to <= from) break; // short chunk: fetch failed or EOF
          buffer.set(chunk.subarray(from, to), offset + written);
          written += to - from;
        }
        return written;
      },
    };
  }
}

export async function loadManifest(): Promise<AssetManifest> {
  const response = await fetch("/GeneralsXAssets");
  return (await response.json()) as AssetManifest;
}
