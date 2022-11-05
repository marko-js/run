import fs from 'fs';
import path from 'path';

export interface WalkEntry {
  name: string,
  path: string
}

export interface WalkOptions {
  onFile?: (file: WalkEntry) => void,
  onDir?: (dir: string) => (() => void) | false | void,
  onEnter?: (dir: WalkEntry) => (() => void) | false | void,
  maxDepth?: number
}

export type Walker = (options: WalkOptions) => Promise<void>;

export function createFSWalker(dir: string): Walker {
  return async function walkFS({ onFile, onEnter, onDir, maxDepth = 50 }: WalkOptions) {

    async function walk(dir: string, depth: number) {
      const dirs: WalkEntry[] = [];
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const prefix = dir + path.sep;
  
      for (const dirEntry of entries) {
        const entry: WalkEntry = {
          name: dirEntry.name,
          path: prefix + dirEntry.name
        };
  
        if (dirEntry.isDirectory()) {
          dirs.push(entry);
        } else {
          onFile?.(entry);
        }
      }
  
      const onAfter = onDir?.(dir);
  
      if (onAfter !== false) {
        if (--depth > 0) {
          for (const entry of dirs) {
            const onExit = onEnter?.(entry);
            if (onExit !== false) {
              await walk(entry.path, depth);
              onExit?.();
            }
          }
        }
    
        onAfter?.();
      }
    }
  
    await walk(dir, maxDepth);
  }
}

export type TestFileTree = [string, (string | TestFileTree)[]];

export function createTestWalker(dir: TestFileTree): Walker {
  return async function walkFS({ onFile, onEnter, onDir, maxDepth = 50 }: WalkOptions) {

    async function walk(dir: TestFileTree, basePath: string, depth: number) {
      const dirs: TestFileTree[] = [];
      const entries = dir[1]
      const prefix = basePath + path.sep;
  
      for (const dirEntry of entries) {
        if (Array.isArray(dirEntry)) {
          dirs.push(dirEntry);
        } else if (onFile) {
          onFile({
            name: dirEntry,
            path: prefix + dirEntry
          });
        }
      }
  
      const onAfter = onDir?.(dir[0]);
      
      if (onAfter !== false) {
        if (--depth > 0) {
          for (const dir of dirs) {
            const onExit = onEnter?.({
              name: dir[0],
              path: prefix + dir[0]
            })
            if (onExit !== false) {
              await walk(dir, `${basePath}${path.sep}${dir[0]}`, depth);
              onExit?.();
            }
          }
        }
    
        onAfter?.();
      }
    }
  
    await walk(dir, '', maxDepth);
  }
}
