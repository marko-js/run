import type { ExplorerData, Route, RoutableFile, RouteGenerationData } from '@marko/run/vite';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, '../../run/.cache/explorer');
const codeDir = path.join(cacheDir, 'code');
const dataFilePath = path.join(cacheDir, 'data.json');

export interface RoutesData {
  hasMiddleware: boolean;
  hasLayouts: boolean;
  hasMeta: boolean;
  generation: RouteGenerationData;
  routes: RouteListItem[];
  special: RouteListItem[];
  files: { name: string, path: string }[];
}

export interface RouteData {
  id: string,
  key: string;
  verbs: ('get' | 'post' | 'put' | 'delete')[];
  path: string;
  params?: string[];
  layouts: RoutableFile[];
  middleware: RoutableFile[];
  meta?: RoutableFile;
  handler?: RoutableFile;
  page?: RoutableFile;
  files: { name: string, path: string }[];
}

export interface RouteListItem {
  id: string;
  verbs: ('get' | 'post' | 'put' | 'delete')[];
  path: string;
  isSpecial: boolean,
  layouts: RoutableFile[];
  middleware: RoutableFile[];
  meta?: RoutableFile;
  handler?: RoutableFile;
  page?: RoutableFile;
  size?: [string, string];
}

const HttpVerbOrder = {
  get: 0,
  post: 1,
  put: 2,
  delete: 3,
};

function getVerbs(route: Route) {
  const verbs = route.handler?.verbs?.slice() || [];
  if (route.page && !verbs.includes('get')) {
    verbs.unshift('get');
  }
  return verbs.sort(
    (a, b) => HttpVerbOrder[a] - HttpVerbOrder[b]
  );
}

function formatPath(path: string) {
  return path
    .replace(/\/\$\$(.*)$/, (_, p) => "/" + `*${p}`) // replace /$$ catch-alls
    .replace(/\/\$([^/]+)/g, (_, p) => "/" + `:${p}`); // replace parameters
}

async function getData() {
  const json = await fs.promises.readFile(dataFilePath, 'utf-8');
  return JSON.parse(json) as ExplorerData
}

export async function getRoutes() {
  const data = await getData();

  const result: RoutesData = {
    hasMeta: false,
    hasMiddleware: false,
    hasLayouts: false,
    generation: data.meta,
    routes: [],
    special: [],
    files: Object.entries(data.files).map(([name, path]) => ({ name, path }))
  };

  for (const [id, route] of Object.entries(data.routes)) {
    if (route.middleware.length) {
      result.hasMiddleware = true;
    }
    if (route.layouts.length) {
      result.hasLayouts = true;
    }
    if (route.meta) {
      result.hasMeta = true;
    }
    const isSpecial = id.startsWith('s');
    const listItem: RouteListItem = {
      verbs: [],
      id,
      isSpecial,
      path: '',
      layouts: route.layouts,
      middleware: route.middleware,
      meta: route.meta,
      handler: route.handler,
      page: route.page,
    }

    if (!isSpecial) {
      for (const path of route.paths) {
        result.routes.push({
          ...listItem,
          verbs: getVerbs(route),
          path: formatPath(path.path)
        });
      }
    } else {
      listItem.path = route.key;
      result.special.push(listItem);
    }
  }

  return result;
}

export async function getRouteById(id: string) {
  const data = await getData();
  const route = data.routes[id];

  if (!route) {
    return undefined;
  }

  const isSpecial = id.startsWith('s');
  const result: RouteData = {
    id,
    key: route.key,
    verbs: [],
    path: '',
    layouts: route.layouts,
    middleware: route.middleware,
    meta: route.meta,
    handler: route.handler,
    page: route.page,
    files: [{ name: 'Marko Template', path: `${route.entryName}.marko`}]
  };
  
  if (!isSpecial) {
    const path = route.paths[0];
    result.path = formatPath(path.path);
    result.verbs = getVerbs(route);
    result.params = path.params ? Object.keys(path.params) : undefined;
    result.files.push({ name: 'JavaScript Entry', path: `${route.entryName}.js`})
  }

  return result;
}

export function getFileStream(name: string) {
  const filePath = path.join(codeDir, name);
  if (fs.existsSync(filePath)) {
    return fs.createReadStream(filePath, { encoding: 'utf-8' });
  }
  return undefined;
}