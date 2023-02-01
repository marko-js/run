import fs from "fs";
import path from "path";
import snap from "mocha-snap";
import { createTestWalker } from "../routes/walk";
import { buildRoutes } from "../routes/builder";
import { createDirectory } from "./utils/fakeFS";
import { renderMiddleware, renderRouteEntry, renderRouter, renderRouteTemplate, renderRouteTypeInfo } from "../codegen";
import { httpVerbs } from "../constants";
import type { HttpVerb } from "../types";

const FIXTURES = path.join(__dirname, "fixtures");

for (const entry of fs.readdirSync(FIXTURES)) {
  if (entry.endsWith(".skip")) {
    it.skip(entry.slice(0, -".skip".length));
    continue;
  }

  it(entry, async () => {
    const dir = path.join(FIXTURES, entry);
    const filename = path.join(dir, "routes.txt");
    const src = await fs.promises.readFile(filename, "utf-8");
    // Use this if you want to psuedo test on windows locally.
    // const src = (await fs.promises.readFile(filename, "utf-8")).replace(/\n/g, "\r\n");

    const fakeDirectory = createDirectory(src);
    const routes = await buildRoutes(createTestWalker(fakeDirectory), 'src/routes');

    let routesSnap = '';

    if (routes.middleware.length) {
      routesSnap += `# Middleware\n`;
      routesSnap += '```js\n'
      routesSnap += renderMiddleware(routes.middleware);
      routesSnap += '```\n\n\n';
    }

    let i = 0;
    for (const route of routes.list) {
      if (route.handler) {
        const meta = route.handler.name.split('.', 2)[1];
        const verbs = (meta.split('_') as HttpVerb[]).filter(v => httpVerbs.includes(v));
        route.handler.verbs = verbs.length ? verbs : httpVerbs as any;
      }
      if (i > 0) routesSnap += `\n\n`;
      routesSnap += `# Route \`${route.path}\`\n`;
      if (route.page) {
        routesSnap += '## Template\n'
        routesSnap += '```marko\n'
        routesSnap += renderRouteTemplate(route);
        routesSnap += '```\n';
      }
      routesSnap += '## Handler\n'
      routesSnap += '```js\n';
      routesSnap += renderRouteEntry(route);
      routesSnap += '```\n';
      i++;
    }

    for (const route of Object.values(routes.special)) {
      routesSnap += `\n\n# Special \`${route.key}\`\n`;
      routesSnap += '## Template\n'
      routesSnap += '```marko\n'
      routesSnap += renderRouteTemplate(route);
      routesSnap += '```\n'
    }
    
    const routerSnap = renderRouter(routes);

    const typesSnap = renderRouteTypeInfo(routes);
    
    await Promise.all([
      snap(routesSnap, ".routes.md", dir),
      snap(routerSnap, ".router.js", dir),
      snap(typesSnap, ".routetypes.d.ts", dir)
    ]);
  });
}