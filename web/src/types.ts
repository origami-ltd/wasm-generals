/** The engine exports this page calls. Everything generic (FS, run dependencies, the module
    factory shape) comes from @wasm/runtime and is shared with the other ports. */
import type { EmscriptenModule as BaseModule } from "@wasm/runtime";

export interface EmscriptenModule extends BaseModule {
  _GeneralsXLogicFrame?: () => number;
  _GeneralsXMouseX?: () => number;
  _GeneralsXMouseY?: () => number;
  _GeneralsXSetAudioMuted?: (muted: number) => number;
  _GeneralsXLanSetIdentity?: (client: number) => number;
  _GeneralsXPump?: () => void;
}

export type ModuleFactory = (config: Record<string, unknown>) => Promise<EmscriptenModule>;
