import zlib from "node:zlib";
import Table, { HorizontalAlignment } from "cli-table3";
import kleur from "kleur";
import type {
  OutputBundle,
  OutputChunk,
  OutputAsset,
  NormalizedOutputOptions,
} from "rollup";
import type { BuiltRoutes, Route } from "../types";
import { getVerbs } from "./route";
import format from "human-format";
import { Blob } from "buffer";

const HttpVerbColors = {
  get: kleur.green,
  post: kleur.magenta,
  put: kleur.cyan,
  delete: kleur.red,
  other: kleur.white,
};

const HttpVerbOrder = {
  get: 0,
  post: 1,
  put: 2,
  delete: 3,
};

export function logRoutesTable(
  routes: BuiltRoutes,
  bundle: OutputBundle,
  options: NormalizedOutputOptions
) {
  function getRouteChunkName(route: Route) {
    return options.sanitizeFileName(`${route.entryName}.marko`);
  }

  const hasMiddleware = routes.list.some((route) => route.middleware.length);
  const hasMeta = routes.list.some((route) => route.meta);

  const headings = ["Method", "Path", "Entry"];
  const colAligns: HorizontalAlignment[] = ["left", "left", "left"];

  if (hasMiddleware) {
    headings.push("MW");
    colAligns.push("right");
  }
  if (hasMeta) {
    headings.push("Meta");
    colAligns.push("center");
  }

  headings.push("Size/GZip");
  colAligns.push("right");

  const table = new Table({
    head: headings.map((title) => kleur.bold(kleur.white(title.toUpperCase()))),
    wordWrap: true,
    colAligns,
    style: { compact: true },
  });

  for (const route of routes.list) {
    for (const path of route.paths) {
      const verbs = getVerbs(route).sort(
        (a, b) => HttpVerbOrder[a] - HttpVerbOrder[b]
      );
      let firstRow = true;

      for (const verb of verbs) {
        let size = "";
        const entryType: string[] = [];
        if (route.handler) {
          entryType.push(kleur.blue("handler"));
        }
        if (verb === "get" && route.page) {
          entryType.push(kleur.yellow("page"));
          size = prettySize(computeRouteSize(getRouteChunkName(route), bundle));
        }

        const row: any[] = [
          kleur.bold(HttpVerbColors[verb](verb.toUpperCase())),
        ];

        if (verbs.length === 1 || firstRow) {
          row.push({ rowSpan: verbs.length, content: prettyPath(path.path) });
          firstRow = false;
        }

        row.push(entryType.join(" -> "));
        hasMiddleware && row.push(route.middleware.length || "");
        hasMeta && row.push(route.meta ? "✓" : "");
        row.push(size || "");

        table.push(row);
      }
    }
  }

  for (const [key, route] of Object.entries(routes.special).sort() as [
    string,
    Route
  ][]) {
    const row = [kleur.bold(kleur.white("*")), key, kleur.yellow("page")];
    hasMiddleware && row.push("");
    hasMeta && row.push("");

    row.push(prettySize(computeRouteSize(getRouteChunkName(route), bundle)));

    table.push(row);
  }

  console.log(table.toString());
}

function computeRouteSize(
  entryName: string,
  bundle: OutputBundle
): [number, number] {
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === "chunk" && chunk.isEntry && chunk.name === entryName) {
      return computeChunkSize(chunk, bundle);
    }
  }

  return [0, 0];
}

function gzipSize(source: string | Uint8Array): number {
  return zlib.gzipSync(source, { level: 9 }).length;
}

function byteSize(source: string | Uint8Array): number {
  return new Blob([source]).size;
}

function computeChunkSize(
  chunk: OutputChunk | OutputAsset,
  bundle: OutputBundle,
  seen: Set<string> = new Set()
): [number, number] {
  if (chunk.type === "asset") {
    return [byteSize(chunk.source), gzipSize(chunk.source)];
  }

  const size: [number, number] = [byteSize(chunk.code), gzipSize(chunk.code)];
  for (const id of chunk.imports) {
    if (!seen.has(id)) {
      const [bytes, compBytes] = computeChunkSize(bundle[id], bundle, seen);
      size[0] += bytes;
      size[1] += compBytes;
      seen.add(id);
    }
  }
  return size;
}

// Taken from Next.js
function prettySize([bytes, compBytes]: [number, number]): string {
  if (bytes <= 0) {
    return kleur.gray("0.0 kB");
  }

  const [size, prefix] = format(bytes, { decimals: 1 }).split(/\s+/);
  const compSize = format(compBytes, { decimals: 1, prefix, unit: "B" });

  let str = kleur.white(size) + kleur.gray("/");

  // green for 0-20kb
  if (compBytes < 20 * 1000) str += kleur.green(compSize);
  // yellow for 20-50kb
  else if (compBytes < 50 * 1000) str += kleur.yellow(compSize);
  // red for >= 50kb
  else str += kleur.bold(kleur.red(compSize));
  return str;
}

function prettyPath(path: string) {
  return path
    .replace(/\/\$\$(.*)$/, (_, p) => "/" + kleur.bold(kleur.dim(`*${p}`))) // replace /$$ catch-alls
    .replace(/\/\$([^/]+)/g, (_, p) => "/" + kleur.bold(kleur.dim(`:${p}`))); // replace parameters
}

import { palette } from "trucolor";

export function drawMarkoBox(address: string, version: string) {
  const logo = drawLogo(true, false);
  const width = 22;
  const text = [`@marko/run v${version}`, "Server running at", address];
  const paddingSize = 3;
  const padding = "".padEnd(paddingSize);
  const textWidth = Math.max(...text.map((line) => line.length)) + paddingSize;
  for (let i = 0; i < text.length; i++) {
    text[i] = padding + text[i].padEnd(textWidth);
  }
  const border = "".padEnd(textWidth + paddingSize + paddingSize + width, "─");
  const filler = "".padEnd(textWidth + paddingSize);

  return `
╭${border}╮
│${padding}${logo[0]}${filler}│
│${padding}${logo[1]}${filler}│
│${padding}${logo[2]}${text[0]}│
│${padding}${logo[3]}${filler}│
│${padding}${logo[4]}${text[1]}│
│${padding}${logo[5]}${text[2]}│
│${padding}${logo[6]}${filler}│
│${padding}${logo[7]}${filler}│
╰${border}╯
  `;
}

export function drawMarkoLogo(
  drawFill: boolean = true,
  drawColors: boolean = true
) {
  const source = `
   TT____  YY____  R____
  C╱T╲   ╲G╱Y╲   ╲ R╲   ╲
 C╱  T╲  G╱  Y╲   ╲ R╲   ╲
C╱   ╱T╲G╱   ╱Y╲   ╲ R╲   ╲
B╲   ╲ GG‾‾‾‾ O╱   ╱ P╱   ╱
 B╲   ╲    OOO╱   ╱ P╱   ╱
  B╲   ╲  OOO╱   ╱ P╱   ╱
   B‾‾‾‾  OOO‾‾‾‾  P‾‾‾‾
`;

  // ansi escape codes for
  const colorEscapeCodes = palette(
    {},
    {
      B: "#06cfe5",
      C: "#05a5f0",
      T: "#19d89c",
      G: "#81dc09",
      Y: "#ffd900",
      O: "#ff9500",
      R: "#f3154d",
      P: "#ce176c",
    }
  );
  const resetEscape = "\x1b[0m";

  const lines = [];
  const lineWidths = [];
  
  let line = "";
  let lineWidth = 0;
  let width = 0;

  for (let i = 0; i < source.length; i++) {
    let char = source[i];
    if (char === "\n") {
      if (line) {
        if (drawColors) {
          line += resetEscape;
        }
        width = Math.max(lineWidth, width);
        lines.push(line);
        lineWidths.push(lineWidth);
        line = "";
        lineWidth = 0;
      }
    } else if (/[A-Z]/.test(char)) {
      while (source[i + 1] === char) i++;

      if (drawColors) {
        line += colorEscapeCodes[char].in;
      }
      if (drawFill) {
        let fillChar = '';
        for (; i < source.length; i++) {
          char = source[i + 1];
          if (fillChar && char !== " ") {
            break;
          } else if (!fillChar) {
            fillChar = char;
          }
          line += fillChar;
          lineWidth++;
        }
      }
    } else {
      line += char;
      lineWidth++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const padding = width - lineWidths[i];
    if (padding > 0) {
      lines[i] += ' '.repeat(width - lineWidths[i])
    }
  }

  return { lines, width };
}
