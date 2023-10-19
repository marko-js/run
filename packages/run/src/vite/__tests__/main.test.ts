import fs from "fs";
import path from "path";
import snap from "mocha-snap";
import { Walker, createTestWalker } from "../routes/walk";
import { RouteSource, buildRoutes } from "../routes/builder";
import { createDirectory } from "./utils/fakeFS";
import {
  renderMiddleware,
  renderRouteEntry,
  renderRouter,
  renderRouteTemplate,
  renderRouteTypeInfo,
  renderErrorRouter,
  renderEntryTemplate,
} from "../codegen";
import { httpVerbs, markoRunFilePrefix } from "../constants";
import type { BuiltRoutes, HttpVerb } from "../types";

const FIXTURES = path.join(__dirname, "fixtures");

describe("router codegen", () => {
  for (const fixture of fs.readdirSync(FIXTURES)) {
    if (fixture.endsWith(".skip")) {
      it.skip(fixture.slice(0, -".skip".length));
      continue;
    }

    it(fixture, async () => {
      const dir = path.join(FIXTURES, fixture);

      const sources: RouteSource[] = [];

      for (const file of  await fs.promises.readdir(dir, { recursive: false, withFileTypes: true })) {
        if (file.isFile()) {
          const match = /^routes(?:-(.+))?\.txt$/.exec(file.name);
          if (match) {
            const filename = path.join(dir, file.name);
            const src = await fs.promises.readFile(filename, "utf-8");
            // Use this if you want to psuedo test on windows locally.
            // const src = (await fs.promises.readFile(filename, "utf-8")).replace(/\n/g, "\r\n");
            sources.push({
              walker: createTestWalker(createDirectory(src)),
              importPrefix: 'src/routes',
              basePath: match[1]
            });
          }
        }
      }

      if (!sources.length) {
        throw new Error('Missing routes.txt')
      }

      let routes: BuiltRoutes | undefined;
      let error: Error | undefined;

      try {
        routes = await buildRoutes(sources)
      } catch (err) {
        error = err as Error;
      }

      let routesSnap = "# Routes\n\n";
      let routerSnap = "";
      let typesSnap = "";

      if (error || !routes) {
        routesSnap += `## Error\n`;
        routesSnap += "### Template\n";
        routesSnap += "```marko\n";
        routesSnap += renderEntryTemplate(`${markoRunFilePrefix}error`, [
          "<dev-error-page>",
        ]);
        routerSnap = renderErrorRouter(
          (error ||= new Error("No routes generated"))
        ).replace(/(\.[a-z]+):\d+:\d+/gi, "$1:0:0");
      } else {
        if (routes.middleware.length) {
          routesSnap += `## Middleware\n`;
          routesSnap += "```js\n";
          routesSnap += renderMiddleware(routes.middleware);
          routesSnap += "```\n---\n\n";
        }

        let i = 0;
        for (const route of routes.list) {
          if (i > 0) {
            routesSnap += "---\n";
          }
          if (route.handler) {
            const match = route.handler.name.match(
              /\+handler(?:\.(.+))?\.[^.]+/
            );
            const meta = match ? match[1] : "";
            const verbs = (meta.toLowerCase().split("_") as HttpVerb[]).filter(
              (v) => httpVerbs.includes(v)
            );
            route.handler.verbs = verbs.length ? verbs : (httpVerbs as any);
          }
          routesSnap += `## Route \`${route.key}\`\n`;
          routesSnap += `### Paths\n`;
          for (const path of route.paths) {
            routesSnap += `  - \`${path.path}\`\n`;
          }
          if (route.page) {
            routesSnap += "### Template\n";
            routesSnap += "```marko\n";
            routesSnap += renderRouteTemplate(route);
            routesSnap += "```\n";
          }
          routesSnap += "### Handler\n";
          routesSnap += "```js\n";
          routesSnap += renderRouteEntry(route);
          routesSnap += "```\n";
          i++;
        }

        for (const route of Object.values(routes.special)) {
          routesSnap += `\n\n## Special \`${route.key}\`\n`;
          routesSnap += "### Template\n";
          routesSnap += "```marko\n";
          routesSnap += renderRouteTemplate(route);
          routesSnap += "```\n";
        }

        routerSnap = renderRouter(routes);
        typesSnap = await renderRouteTypeInfo(routes);
      }

      await Promise.all(
        [
          routerSnap && snap(routerSnap, ".router.js", dir),
          routesSnap && snap(routesSnap, ".routes.md", dir),
          typesSnap && snap(typesSnap, ".routetypes.d.ts", dir),
        ].filter(Boolean)
      );
    });
  }
});
