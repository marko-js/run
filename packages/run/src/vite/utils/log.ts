import zlib from "node:zlib";

import { Blob } from "buffer";
import Table, { HorizontalAlignment } from "cli-table3";
import format from "human-format";
import kleur from "kleur";
import type { OutputAsset, OutputBundle, OutputChunk } from "rollup";

import type { BuiltRoutes, HttpVerb, Route } from "../types";
import { getVerbs } from "./route";

const HttpVerbColors = {
  get: kleur.green,
  head: kleur.dim().green,
  post: kleur.magenta,
  put: kleur.cyan,
  delete: kleur.red,
  patch: kleur.yellow,
  options: kleur.grey,
};

function verbColor(verb: HttpVerb) {
  return verb in HttpVerbColors
    ? HttpVerbColors[verb as keyof typeof HttpVerbColors]
    : kleur.gray;
}

export function logRoutesTable(routes: BuiltRoutes, bundle: OutputBundle) {
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
    const verbs = getVerbs(route, true);
    let firstRow = true;

    for (const verb of verbs) {
      const entryType: string[] = [];
      let size = "";
      const verbCell = verbColor(verb)(verb.toUpperCase());

      // if (verb === "get" && !verbs.includes("head")) {
      //   verbCell += kleur.dim(`,${verbColor(verb)("HEAD")}`);
      // }
      if (route.handler) {
        entryType.push(kleur.blue("handler"));
      }
      if (route.page && (verb === "get" || verb === "head")) {
        entryType.push(kleur.yellow("page"));
        if (verb === "get") {
          size = prettySize(computeRouteSize(route, bundle));
        }
      }

      const row: any[] = [verbCell];

      if (verbs.length === 1 || firstRow) {
        row.push({
          rowSpan: verbs.length,
          content: prettyPath(route.path.path),
        });
        firstRow = false;
      }

      row.push(entryType.join(" -> "));
      hasMiddleware && row.push(route.middleware.length || "");
      hasMeta && row.push(route.meta ? "✓" : "");
      row.push(size || "");

      table.push(row);
    }
  }

  for (const [key, route] of Object.entries(routes.special).sort() as [
    string,
    Route,
  ][]) {
    const row = [kleur.bold(kleur.white("*")), key, kleur.yellow("page")];
    hasMiddleware && row.push("");
    hasMeta && row.push("");

    row.push(prettySize(computeRouteSize(route, bundle)));

    table.push(row);
  }

  if (!table.length) {
    table.push([
      {
        colSpan: 4,
        hAlign: "center",
        content: kleur.dim(kleur.white("No routes found")),
      },
    ]);
  }

  console.log(table.toString());
}

function computeRouteSize(
  route: Route,
  bundle: OutputBundle,
): [number, number] {
  const facadeModuleId =
    route.templateFilePath && `${route.templateFilePath}.html`;
  if (facadeModuleId) {
    for (const chunk of Object.values(bundle)) {
      if (
        chunk.type === "chunk" &&
        chunk.isEntry &&
        chunk.facadeModuleId === facadeModuleId
      ) {
        return computeChunkSize(chunk, bundle);
      }
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
  seen: Set<string> = new Set(),
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
  return path.replace(
    /\/(\$\$?)(`?)([^/`]+)\2/g,
    (_, type, tick, key) =>
      "/" + type + tick + kleur.bold(kleur.dim(key)) + tick,
  );
}
