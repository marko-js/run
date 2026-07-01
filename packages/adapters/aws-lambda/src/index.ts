import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import baseAdapter, { type Adapter } from "@marko/run/adapter";
import { loadEnv } from "@marko/run/vite";

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  LambdaContext,
} from "./types";

export type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  AWSLambdaPlatformInfo,
  LambdaContext,
} from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

type Handler = (
  event: APIGatewayProxyEventV2,
  context: LambdaContext,
) => Promise<APIGatewayProxyResultV2>;

export default function awsLambdaAdapter(): Adapter {
  const { startDev } = baseAdapter();

  return {
    name: "aws-lambda-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          ssr: {
            target: "node",
            // Bundle everything so the Lambda deployment package is
            // self-contained and needs no `node_modules`.
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

    async startPreview({ entry, options }) {
      const { port = 3000, dir, envFile } = options;
      const entryFile = entry || path.join(dir, "index.mjs");

      if (envFile) {
        await loadEnv(envFile);
      }

      // Invoke the built Lambda handler behind a local HTTP server so the app
      // can be previewed without deploying (or running SAM).
      const { handler } = (await import(pathToFileURL(entryFile).href)) as {
        handler: Handler;
      };

      const server = createServer((req, res) => {
        readBody(req)
          .then(async (body) => {
            const result = await handler(nodeRequestToEvent(req, body), {
              functionName: "marko-run-preview",
              functionVersion: "$LATEST",
              invokedFunctionArn: "",
              memoryLimitInMB: "128",
              awsRequestId: "preview",
              logGroupName: "",
              logStreamName: "",
              getRemainingTimeInMillis: () => 30000,
            });

            res.statusCode = result.statusCode;
            for (const [key, value] of Object.entries(result.headers || {})) {
              res.setHeader(key, value);
            }
            if (result.cookies?.length) {
              res.setHeader("set-cookie", result.cookies);
            }
            res.end(
              result.body
                ? Buffer.from(
                    result.body,
                    result.isBase64Encoded ? "base64" : "utf8",
                  )
                : undefined,
            );
          })
          .catch((error) => {
            res.statusCode = 500;
            res.end(String(error));
          });
      });

      return new Promise((resolve) => {
        const listener = server.listen(port, () => {
          const address = listener.address() as AddressInfo;
          console.log(
            `Preview server started: http://localhost:${address.port}`,
          );
          resolve({
            port: address.port,
            close() {
              listener.close();
            },
          });
        });
      });
    },

    typeInfo(writer) {
      writer(
        `import type { AWSLambdaPlatformInfo } from '@marko/run-adapter-aws-lambda';`,
      );
      return "AWSLambdaPlatformInfo";
    },
  };
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function nodeRequestToEvent(
  req: IncomingMessage,
  body: Buffer,
): APIGatewayProxyEventV2 {
  const url = new URL(req.url || "/", "http://localhost");
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  // The preview server is plain HTTP; make sure the built request uses it too.
  headers["x-forwarded-proto"] = "http";
  const cookies = req.headers.cookie
    ? req.headers.cookie.split(/;\s*/).filter(Boolean)
    : undefined;

  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    cookies,
    headers,
    requestContext: {
      accountId: "preview",
      apiId: "preview",
      domainName: headers.host || "localhost",
      domainPrefix: "preview",
      http: {
        method: req.method || "GET",
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: req.socket.remoteAddress || "127.0.0.1",
        userAgent: headers["user-agent"] || "",
      },
      requestId: "preview",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
    body: body.length ? body.toString("base64") : undefined,
    isBase64Encoded: true,
  };
}
