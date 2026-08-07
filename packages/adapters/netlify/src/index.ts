import baseAdapter, {
  type Adapter,
  closeSpawnedProcess,
} from "@marko/run/adapter";
import type { BuiltRoutes, PathInfo } from "@marko/run/vite";
import { execSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

export type {
  NetlifyEdgePlatformInfo,
  NetlifyFunctionsPlatformInfo,
} from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEdgeEntry = path.join(__dirname, "default-edge-entry");
const defaultFunctionsEntry = path.join(__dirname, "default-functions-entry");
const routesId = "virtual:marko-run-adapter-netlify/routes";
const resolvedRoutesId = `\0${routesId}`;

// The CLI evaluates the vite config to resolve the adapter and the build
// evaluates it again, so the instance that contributes the plugin is not the
// one that receives the routes. Keyed by root so concurrent builds of
// different apps stay apart.
const declarationsByRoot = new Map<string, EdgeDeclaration>();

interface EdgeDeclaration {
  /** The paths that run the edge function. */
  path: string[];
  /** Paths the platform keeps, whichever declaration matched them. */
  excludedPath: string[];
}

export interface Options {
  edge?: boolean;
}

export default function netlifyAdapter(options: Options = {}): Adapter {
  const { startDev } = baseAdapter();
  const defaultEntry = options.edge ? defaultEdgeEntry : defaultFunctionsEntry;
  let root: string;
  let assetsDir = "assets";
  return {
    name: "netlify-adapter",

    plugins({ root }) {
      if (!options.edge) return;
      return [
        {
          name: "marko-run-adapter-netlify:routes",
          resolveId(id) {
            if (id === routesId) return resolvedRoutesId;
          },
          async load(id) {
            if (id !== resolvedRoutesId) return;
            // Loading the router builds the route table, which is what fills
            // the entry in `routesGenerated`.
            const router = await this.resolve("@marko/run/router");
            if (router) await this.load({ id: router.id });
            const declaration = declarationsByRoot.get(root) || {
              path: [],
              excludedPath: [],
            };
            return `export default ${JSON.stringify(declaration)};`;
          },
        },
      ];
    },

    configure(config) {
      root = config.root;
    },

    routesGenerated({ routes }) {
      declarationsByRoot.set(root, {
        path: toEdgePaths(routes),
        // The build owns this directory, so a catch-all route must not claim
        // it -- excluding it keeps those apps' assets served.
        excludedPath: [`/${assetsDir}/*`],
      });
    },

    viteConfig(config) {
      assetsDir = config.build?.assetsDir || "assets";
      if (config.build?.ssr) {
        return {
          ssr: {
            target: options.edge ? "webworker" : "node",
            resolve: {
              dedupe: ["marko"],
              conditions: options.edge
                ? [
                    "worker",
                    "node",
                    "import",
                    "require",
                    "production",
                    "default",
                  ]
                : undefined,
            },
            noExternal: true,
          },
        };
      }
    },

    getEntryFile() {
      return defaultEntry;
    },

    startDev(event) {
      return startDev!({
        ...event,
        entry: event.entry === defaultEntry ? undefined : event.entry,
      });
    },

    async startPreview({ options: previewOptions }) {
      assertNetlifyCLI();

      const { port = 3000, cwd } = previewOptions;

      const args = [
        "dev",
        "--dir",
        path.join(previewOptions.dir, "public"),
        "--port",
        port.toString(),
        "--cwd",
        cwd,
      ];

      if (!options.edge) {
        args.push("--functions", previewOptions.dir);
      }

      args.push(...parseNetlifyArgs(previewOptions.args));

      // Join the command and args into a single string rather than passing an
      // args array alongside `shell: true`, which Node deprecates (DEP0190).
      const proc = spawn(["netlify", ...args].join(" "), {
        cwd,
        env: options.edge
          ? { ...process.env, DENO_TLS_CA_STORE: "mozilla,system" }
          : process.env,
        shell: true,
        detached: process.platform !== "win32",
      });

      if (process.env.NODE_ENV !== "test") {
        proc.stdout.pipe(process.stdout);
      }
      proc.stderr.pipe(process.stderr);

      return {
        port,
        close() {
          return closeSpawnedProcess(proc);
        },
      };
    },

    typeInfo(writer) {
      if (options.edge) {
        writer(
          `import type { NetlifyEdgePlatformInfo } from '@marko/run-adapter-netlify';`,
        );
        return "NetlifyEdgePlatformInfo";
      }
      writer(
        `import type { NetlifyFunctionsPlatformInfo } from '@marko/run-adapter-netlify';`,
      );
      return "NetlifyFunctionsPlatformInfo";
    },
  };
}
// Netlify only runs an edge function for the paths its declaration selects,
// so every route becomes a declaration and everything else -- published
// files included -- stays with the platform's own static handling.
function toEdgePaths(routes: BuiltRoutes) {
  const paths = new Set<string>();
  for (const route of routes.list) {
    const edgePath = toEdgePath(route.path);
    paths.add(edgePath);
    // A trailing slash is a different path to Netlify, and the router
    // redirects or rewrites it according to the `trailingSlashes` option.
    if (edgePath !== "/" && !edgePath.endsWith("*")) {
      paths.add(`${edgePath}/`);
    }
  }
  return [...paths];
}

// Marko Run writes a dynamic segment as `$name` and a catch-all as `$$name`;
// Netlify declarations use `:name` and `*`.
function toEdgePath({ segments, params }: PathInfo) {
  const names: Record<number, string> = {};
  for (const [name, index] of Object.entries(params || {})) {
    if (index !== null) names[index] = name;
  }
  return `/${segments
    .map((segment, index) => {
      if (segment === "$$") return "*";
      if (segment === "$") return `:${names[index] || `param${index}`}`;
      return segment;
    })
    .join("/")}`;
}

const devFlags = new RegExp(
  [
    "context=.+",
    "country=.+",
    "edge-inspect-brk(=.+)?",
    "edge-inspect(=.+)?",
    "functions=.+",
    "functions-port=.+",
    "geo=.+",
    "live",
    "offline",
    "session-id(=.+)?",
    "target-port=.+",
    "debug",
    "http-proxy(=.+)?",
    "http-proxy-certificate-filename(=.+)?",
  ]
    .map((flag) => {
      return `--${flag}`;
    })
    .join("|"),
);

function parseNetlifyArgs(args: string[]) {
  return args.filter((arg) => devFlags.test(arg));
}

function assertNetlifyCLI() {
  try {
    execSync("netlify --version");
  } catch (error) {
    console.warn(
      `Netlify CLI not found. Please install it globally with \`npm install -g netlify-cli\``,
    );
    process.exit(1);
  }
}
