import fs from "fs";
import path from "path";

export interface WalkEntry {
  name: string;
  path: string;
}

export interface WalkOptions {
  onEnter?: (dir: WalkEntry) => (() => void) | false | void;
  onFile?: (file: WalkEntry) => void;
  onDir?: () => boolean;
  maxDepth?: number;
}

export type Walker = (options: WalkOptions) => Promise<void>;

export function createFSWalker(dir: string): Walker {
  return async function walkFS({
    onEnter,
    onFile,
    onDir,
    maxDepth = 50,
  }: WalkOptions) {
    async function walk(dir: WalkEntry, depth: number) {
      const onExit = onEnter?.(dir);

      if (onExit !== false) {
        const dirs: WalkEntry[] = [];
        const entries = await fs.promises.readdir(dir.path, {
          withFileTypes: true,
        });
        const prefix = dir.path + path.sep;

        for (const entry of entries) {
          const walkEntry: WalkEntry = {
            name: entry.name,
            path: prefix + entry.name,
          };

          if (entry.isDirectory()) {
            dirs.push(walkEntry);
          } else {
            onFile?.(walkEntry);
          }
        }

        if (onDir?.() !== false && --depth > 0) {
          for (const entry of dirs) {
            await walk(entry, depth);
          }
        }

        onExit?.();
      }
    }

    await walk(
      {
        path: dir,
        name: path.basename(dir),
      },
      maxDepth
    );
  };
}

export type TestFileTree = [string, (string | TestFileTree)[]];

export function createTestWalker(dir: TestFileTree): Walker {
  return async function walkFS({
    onEnter,
    onFile,
    onDir,
    maxDepth = 50,
  }: WalkOptions) {
    async function walk(dir: TestFileTree, currentPath: string, depth: number) {
      const onExit = onEnter?.({
        name: dir[0],
        path: currentPath,
      });

      if (onExit !== false) {
        const dirs: TestFileTree[] = [];
        const prefix = currentPath + path.sep;

        for (const entry of dir[1]) {
          if (Array.isArray(entry)) {
            dirs.push(entry);
          } else if (onFile) {
            onFile({
              name: entry,
              path: prefix + entry,
            });
          }
        }

        if (onDir?.() !== false && --depth > 0) {
          for (const entry of dirs) {
            await walk(entry, prefix + entry[0], depth);
          }
        }

        onExit?.();
      }
    }

    await walk(dir, dir[0], maxDepth);
  };
}
