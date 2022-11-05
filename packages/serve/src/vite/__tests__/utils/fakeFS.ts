import type { TestFileTree } from "../../routes/walk";

export function createDirectory(content: string): TestFileTree {

  const matchLine = /(.*)\n?/g;

  let current: TestFileTree = ['', []];
  const stack = [current];

  let match = matchLine.exec(content);
  let lineNo = 1;
  while (match && match.index < content.length) {
    const line = match[1].replace(/\t/, '  ').match(/^(\s*)([/]?)(.+)\s*/)
    if (line) {
      const depth = Math.ceil(line[1].length / 2) + 1; 
      const isDir = line[2] === '/';
      const name = line[3];

      if (depth < stack.length) {
        stack.length = depth;
        current = stack[depth - 1];
      } else if (depth > stack.length) {
        throw new Error(`Error at line ${lineNo}: ${isDir ? 'dir' : 'file'} is at incorrect depth - expected ${stack.length} but found ${depth} -- ${stack.map(d => d[0]).join('/')}`);
      }

      if (isDir) {
        const dir: TestFileTree = [name, []];
        if (current) {
          current[1].push(dir);
        }
        stack.push(dir);
        current = dir
      } else {
        current[1].push(name);
      }
    }

    match = matchLine.exec(content);
    lineNo++;
  }

  return stack[0];
}