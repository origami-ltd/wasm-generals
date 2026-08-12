/**
 * Which files on the player's disk are "Generals", and where they mount.
 *
 * The streaming machinery itself lives in @wasm/runtime and knows nothing about this game — only
 * the discovery rules below are Zero Hour's: two installs (base game + expansion), `.big` archives,
 * and the *ZH.big naming that tells them apart.
 */
import { FolderStore, loadManifest as fetchManifest } from "@wasm/runtime";
import type { ArchiveEntry, AssetManifest } from "@wasm/runtime";

/** One IDB database per game, so clearing Generals never touches another port's install. */
export const folders = new FolderStore("generalsx");

const MOUNTS = ["GeneralsZH", "Generals"] as const;

export const loadManifest = (): Promise<AssetManifest> => fetchManifest("/GeneralsXAssets");

/** Walk a picked directory looking for the two archive sets, wherever they sit inside it. */
export async function findArchiveDirs(
  root: FileSystemDirectoryHandle,
  depth = 3,
): Promise<Map<string, FileSystemDirectoryHandle>> {
  const found = new Map<string, FileSystemDirectoryHandle>();
  const visit = async (directory: FileSystemDirectoryHandle, level: number): Promise<void> => {
    let zeroHour = false;
    let base = false;
    const children: FileSystemDirectoryHandle[] = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === "directory") {
        children.push(handle as FileSystemDirectoryHandle);
      } else if (name.toLowerCase().endsWith(".big")) {
        // ZH ships *ZH.big archives; the base game does not. That is the whole discriminator.
        if (/zh\.big$/i.test(name)) zeroHour = true;
        else base = true;
      }
    }
    if (zeroHour && !found.has("GeneralsZH")) found.set("GeneralsZH", directory);
    else if (base && !zeroHour && !found.has("Generals")) found.set("Generals", directory);
    if (found.size === 2 || level >= depth) return;
    for (const child of children) {
      await visit(child, level + 1);
      if (found.size === 2) return;
    }
  };
  await visit(root, 0);
  return found;
}

/** Archives from the folders the player picked, read locally with no server involvement. */
export async function localArchives(options: { request?: boolean } = {}): Promise<ArchiveEntry[]> {
  try {
    const picked = await folders.load(MOUNTS, options);
    const entries: ArchiveEntry[] = [];
    for (const mount of MOUNTS) {
      const directory = picked.get(mount);
      if (!directory) continue;
      for await (const [name, handle] of directory.entries()) {
        if (!name.toLowerCase().endsWith(".big") || handle.kind !== "file") continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({
          mount: `/${mount}`,
          name,
          url: `local:${mount}/${name}`,
          size: file.size,
          // Resolved to a File here: the reader worker is sent this, and a File clones in
          // every engine while a handle does not.
          file: await (handle as FileSystemFileHandle).getFile(),
        });
      }
    }
    return entries;
  } catch (error) {
    // Never let a permission/IDB failure skip mounting entirely — the caller falls back to the server.
    console.debug("local archives unavailable", error);
    return [];
  }
}

/** True when the player already picked folders, even if this load cannot read them yet. */
export const hasSavedFolders = (): Promise<boolean> => folders.hasAny();
