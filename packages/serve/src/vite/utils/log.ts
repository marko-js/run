import Table from 'cli-table3';
import kleur from 'kleur';
import { gzipSizeSync } from 'gzip-size';
import prettyBytes from 'pretty-bytes';
import type { OutputBundle, OutputChunk, OutputAsset } from 'rollup';
import type { BuiltRoutes, Route } from "../types";
import { getVerbs } from './route';


const HttpVerbColors = {
  get: kleur.green,
  post: kleur.magenta,
  put: kleur.cyan,
  delete: kleur.red,
  other: kleur.white
};

const HttpVerbOrder = {
  get: 0,
  post: 1,
  put: 2,
  delete: 3
};

export function logRoutesTable(routes: BuiltRoutes, bundle: OutputBundle) {
  const headings = ['Method', 'Path', 'Entry', 'MW', 'Meta', 'Size'];

  const table = new Table({
    head: headings.map(title => kleur.bold(kleur.white(title.toUpperCase()))),
    wordWrap: true,
    colAligns: ['left', 'left', 'left', 'right', 'center', 'right'],
    style: { compact: true },
  });

  for (const route of routes.list.sort((a, b) => b.score - a.score)) {
    const verbs = getVerbs(route).sort((a, b) => HttpVerbOrder[a] - HttpVerbOrder[b]);
    let firstRow = true;

    for (const verb of verbs) {
      let size = '';
      const entryType: string[] = [];
      if (route.handler) {
        entryType.push(kleur.blue('handler'));
      }
      if (verb === 'get' && route.page) {
        entryType.push(kleur.yellow('page'));
        size = prettySize(computeRouteSize(route, bundle));
      }
      
      const row: any[] = [
        kleur.bold(HttpVerbColors[verb](verb.toUpperCase()))
      ];

      if (verbs.length === 1 || firstRow) {
        row.push({ rowSpan: verbs.length, content: prettyPath(route.path) });
        firstRow = false;
      }

      row.push(
        entryType.join(' -> '),
        route.middleware.length || '',
        route.meta ? '✓' : '',
        size || { hAlign: 'center', content: '-' }
      );

      table.push(row);
    }
  }

  for (const [key, route] of Object.entries(routes.special).sort()) {
    table.push([
      kleur.bold(kleur.white("*")),
      key,
      kleur.yellow('page'),
      '',
      '',
      prettySize(computeRouteSize(route, bundle))
    ]);
  }
  
  console.log(table.toString())
}


function computeRouteSize(
  route: Route,
  bundle: OutputBundle
) {
  if (route.page) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && chunk.modules[route.page.filePath]) {
        return computeChunkSize(chunk, bundle);
      }
    }
  }

  return 0;
}

function computeChunkSize(chunk: OutputChunk | OutputAsset, bundle: OutputBundle, seen: Set<string> = new Set()): number {
  if (chunk.type === 'asset') {
    return gzipSizeSync(chunk.source as string | Buffer);
  }

  let size = gzipSizeSync(chunk.code);
  for (const id of chunk.imports) {
    if (!seen.has(id)) {
      size += computeChunkSize(bundle[id], bundle, seen);
      seen.add(id);
    }
  }
  return size;
}

// Taken from Next.js
function prettySize(size: number) {
  const _size = prettyBytes(size, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/\sB$/, ' B ');
  // green for 0-20kb
  if (size < 20 * 1000) return kleur.green(_size);
  // yellow for 20-50kb
  if (size < 50 * 1000) return kleur.yellow(_size);
  // red for >= 50kb
  return kleur.bold(kleur.red(_size));
};

function prettyPath(path: string) {
  return path
    .replace(/\/\$\$(.*)$/, (_, p) => '/' + kleur.bold(kleur.dim(`*${p}`))) // replace /$$ catch-alls
    .replace(/\/\$([^/]+)/g, (_, p) => '/' + kleur.bold(kleur.dim(`:${p}`))) // replace parameters
}