import baseAdapter, { type Adapter } from "@marko/run/adapter";
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

export interface Options {
  edge?: boolean;
}

export default function netlifyAdapter(options: Options = {}): Adapter {
  const { startDev } = baseAdapter();
  const defaultEntry = options.edge ? defaultEdgeEntry : defaultFunctionsEntry;
  return {
    name: "netlify-adapter",

    viteConfig(config) {
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

      const proc = spawn("netlify", args, {
        cwd,
        env: options.edge
          ? { ...process.env, DENO_TLS_CA_STORE: "mozilla,system" }
          : process.env,
        shell: true,
      });

      if (process.env.NODE_ENV !== "test") {
        proc.stdout.pipe(process.stdout);
      }
      proc.stderr.pipe(process.stderr);

      return {
        port,
        close() {
          proc.unref();
          proc.kill();
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
      `Netlfiy CLI not found. Please install it globally with \`npm install -g netlify-cli\``,
    );
    process.exit(1);
  }
}
