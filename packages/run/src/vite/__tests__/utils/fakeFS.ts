import { sep } from "path";

import type { TestFileTree } from "../../routes/walk";

export function createDirectory(
  content: string,
  baseDir: string = "",
  onData?: (file: string, data: string) => void,
): TestFileTree {
  const matchLine = /(.*)\r?\n?/g;

  let match = matchLine.exec(content);
  let lineNo = 1;
  let indent: number | undefined;
  let current: TestFileTree = [baseDir, []];
  const stack = [current];
  const dirStack = [baseDir];

  while (match && match.index < content.length) {
    const line = match[1]
      .replace(/\t/, "  ")
      .match(/^(\s*)([/]?)([^\s/]\S*)(.*)?$/);
    if (line) {
      indent ??= line[1].length;

      const depth = Math.ceil((line[1].length - indent) / 2) + 1;
      const isDir = line[2] === "/";
      const name = line[3]?.trim();
      const data = line[4]?.trim();

      if (depth > stack.length || depth < 0) {
        throw new Error(
          `Line ${lineNo} '${match[1]}': ${isDir ? "dir" : "file"} is at incorrect depth - expected ${stack.length} but found ${depth} -- ${stack.map((d) => d[0]).join("/")}`,
        );
      } else if (depth < stack.length) {
        stack.length = depth;
        dirStack.length = depth;
        current = stack[depth - 1];
      }

      if (isDir) {
        const dir: TestFileTree = [name, []];
        if (current) {
          current[1].push(dir);
        }
        stack.push(dir);
        dirStack.push(name);
        current = dir;
      } else {
        if (onData && data) {
          onData(`${dirStack.join(sep)}${sep}${name}`, data);
        }
        current[1].push(name);
      }
    }

    match = matchLine.exec(content);
    lineNo++;
  }

  return stack[0];
}
