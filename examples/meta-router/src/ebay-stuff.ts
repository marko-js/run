import type { Options } from '@marko/serve/vite';
import fs from "fs/promises";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RouteManifestEntry {
  route: string;
  matchOptions: {
    sensitive: boolean;
    strict: boolean;
    end: boolean;
  };
  [key: string]: any;
}

const adapter: Options = {
  async emitRoutes(routes) {
    const routeManifest: RouteManifestEntry[] = [];

    for (const route of routes) {
      let meta;
      if (route.meta) {
        if (route.meta.name.endsWith(".json")) {
          meta = JSON.parse(await fs.readFile(route.meta.filePath, {
            encoding: "utf-8",
          }));
        } else if (route.meta.name.endsWith('.js')) {
          meta = (await import(route.meta.filePath)).default
        }
      }

      const path = route.path
        .replace(/\/\$\$(.*)$/, (_, p) => p ? `/:${p}*` : '/(.*)') // replace /$$ catch-alls
        .replace(/\/\$([^/]+)/g, '/:$1') // replace parameters

      if (route.page) {
        routeManifest.push({
          route: `GET ${path} => ${route.page.importPath}`,
          ...meta,
        });
      }
      if (route.handler?.verbs) {
        for (const verb of route.handler.verbs) {
          if (verb === 'get' && route.page) {
            continue;
          }
          routeManifest.push({
            route: `${verb.toUpperCase()} ${path} => ${
              route.handler.importPath
            }#${verb}$${route.index}`,
            ...meta,
          });
        }
      }
    }

    await fs.writeFile(path.join(__dirname, 'routes.json'), JSON.stringify(routeManifest, undefined, 2))
  },
}

export default adapter;