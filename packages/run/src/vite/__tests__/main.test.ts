import fs from "fs";
import mochaSnap from "mocha-snap";
import path from "path";
import url from "url";

import { prepareError } from "../../adapter/utils";
import {
  renderMiddleware,
  renderRouteEntry,
  renderRouter,
  renderRouteTemplate,
  renderRouteTypeInfo,
} from "../codegen";
import { httpVerbs } from "../constants";
import { buildRoutes, type RouteSource } from "../routes/builder";
import { createTestWalker } from "../routes/walk";
import type { BuiltRoutes, HttpVerb, Route } from "../types";
import { createDirectory } from "./utils/fakeFS";
import { normalizeErrorStack } from "./utils/sanitize";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const snap = (mochaSnap as any).default as typeof mochaSnap;

const FIXTURES = path.join(__dirname, "fixtures");

describe("router codegen", () => {
  for (const fixture of fs.readdirSync(FIXTURES)) {
    if (fixture.endsWith(".skip")) {
      it.skip(fixture.slice(0, -".skip".length));
      continue;
    }

    it(fixture, async () => {
      const dir = path.join(FIXTURES, fixture);
      const routesDir = path.join(dir, "src", "routes");
      const typesDir = path.join(dir, ".marko-run");
      const entryFilesDir = path.join(dir, "dist", ".marko-run");
      const sources: RouteSource[] = [];

      for (const file of await fs.promises.readdir(dir, {
        recursive: false,
        withFileTypes: true,
      })) {
        if (file.isFile()) {
          const match = /^routes(?:-(.+))?\.txt$/.exec(file.name);
          if (match) {
            const filename = path.join(dir, file.name);
            const src = await fs.promises.readFile(filename, "utf-8");
            // Use this if you want to psuedo test on windows locally.
            // const src = (await fs.promises.readFile(filename, "utf-8")).replace(/\n/g, "\r\n");
            sources.push({
              walker: createTestWalker(createDirectory(src), routesDir),
              basePath: match[1],
            });
          }
        }
      }

      if (!sources.length) {
        throw new Error("Missing routes.txt");
      }

      let routes: BuiltRoutes | undefined;
      let error: Error | undefined;

      try {
        routes = await buildRoutes(sources, entryFilesDir);
      } catch (err) {
        error = err as Error;
      }

      let routesSnap = "# Routes\n\n";
      let routerSnap = "";
      let typesSnap = "";

      if (error || !routes) {
        normalizeErrorStack((error ||= new Error("No routes generated")));
        routerSnap = `throw ${JSON.stringify(prepareError(error)).replace(/\\\\/g, "/")}`;
      } else {
        if (routes.middleware.length) {
          routesSnap += `## Middleware\n`;
          routesSnap += "```js\n";
          routesSnap += renderMiddleware(routes.middleware, dir);
          routesSnap += "```\n---\n\n";
        }

        let i = 0;
        for (const route of routes.list) {
          if (i > 0) {
            routesSnap += "---\n";
          }
          if (route.handler) {
            const match = route.handler.name.match(
              /\+handler(?:\.(.+))?\.[^.]+/,
            );
            const meta = match ? match[1] : "";
            const verbs = (meta.toLowerCase().split("_") as HttpVerb[]).filter(
              (v) => httpVerbs.includes(v),
            );
            route.handler.verbs = verbs.length ? verbs : (httpVerbs as any);
          }
          routesSnap += `## Route \`\`${route.key}\`\`\n`;
          routesSnap += `### Path: \`\`${route.path.path}\`\`\n`;

          if (route.page) {
            if (route.templateFilePath) {
              routesSnap += "### Template\n";
              routesSnap += "```marko\n";
              routesSnap += renderRouteTemplate(route, dir);
              routesSnap += "```\n";
            }
          }
          routesSnap += "### Handler\n";
          routesSnap += "```js\n";
          routesSnap += renderRouteEntry(route, dir);
          routesSnap += "```\n";
          i++;
        }

        for (const route of Object.values(routes.special) as Route[]) {
          if (route.page && route.layouts.length) {
            routesSnap += `\n\n## Special \`${route.key}\`\n`;
            routesSnap += "### Template\n";
            routesSnap += "```marko\n";
            routesSnap += renderRouteTemplate(route, dir);
            routesSnap += "```\n";
          }
        }

        routerSnap = renderRouter(routes, dir);
        typesSnap = await renderRouteTypeInfo(routes, typesDir);
      }

      await Promise.all(
        [
          routerSnap && snap(routerSnap, { ext: ".router.js", dir }),
          routesSnap && snap(routesSnap, { ext: ".routes.md", dir }),
          typesSnap && snap(typesSnap, { ext: ".routetypes.d.ts", dir }),
        ].filter(Boolean),
      );
    });
  }
});
