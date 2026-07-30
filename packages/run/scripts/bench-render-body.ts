// Measures the node adapter's two ways of writing a page response, end to end
// over HTTP using the real runtime (`createContext().render()`) and the real
// middleware:
//
//   render -- the `getRender` shortcut: the middleware takes the raw Marko
//             render stashed on the response and writes its HTML strings
//             straight to the socket, letting node encode UTF-8 natively.
//   body   -- the same response with the stash removed, so the middleware
//             falls back to reading the WHATWG `response.body` stream
//             (TextEncoder + ReadableStream machinery per chunk).
//
// Usage: npx tsx packages/run/scripts/bench-render-body.ts
import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";

import { createMiddleware } from "../src/adapter/middleware";
import { createContext } from "../src/runtime/internal";

process.env.NODE_ENV ||= "production";

const kRender = Symbol.for("@marko/run.render");
const CONCURRENCY = 8;
const ROUNDS = 3;

interface Scenario {
  name: string;
  chunks: string[];
  requests: number;
}

function page(chunkCount: number, chunkSize: number) {
  const chunk = `<div>${"marko ".repeat((chunkSize - 11) / 6)}</div>`;
  return Array.from({ length: chunkCount }, () => chunk);
}

const scenarios: Scenario[] = [
  { name: "small page", chunks: page(16, 256), requests: 8000 },
  { name: "medium page", chunks: page(128, 512), requests: 2000 },
  { name: "large page", chunks: page(256, 1024), requests: 600 },
];

type Mode = "render" | "body";

function createServer(mode: Mode, chunks: string[]) {
  const template = {
    render: () => ({
      async *[Symbol.asyncIterator]() {
        yield* chunks;
      },
    }),
  } as any;

  const middleware = createMiddleware((request, platform) => {
    const response = createContext(null, request, platform).render(
      template,
      {},
    );
    if (mode === "body") {
      delete (response as any)[kRender];
    }
    return response;
  });

  const server = http.createServer(middleware);
  return new Promise<http.Server>((resolve) =>
    server.listen(0, () => resolve(server)),
  );
}

async function timeBatch(
  port: number,
  requests: number,
  expectedBytes: number,
) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });
  const get = () =>
    new Promise<number>((resolve, reject) => {
      http
        .get({ port, agent, path: "/" }, (res) => {
          let bytes = 0;
          res.on("data", (data: Buffer) => (bytes += data.length));
          res.on("end", () => resolve(bytes));
          res.on("error", reject);
        })
        .on("error", reject);
    });

  let started = 0;
  let bytes = 0;
  const start = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (started < requests) {
        started++;
        const received = await get();
        assert.equal(received, expectedBytes);
        bytes += received;
      }
    }),
  );
  const seconds = (performance.now() - start) / 1000;
  agent.destroy();
  return { seconds, bytes };
}

for (const scenario of scenarios) {
  const html = scenario.chunks.join("");
  const expectedBytes = Buffer.byteLength(html);
  console.log(
    `\n${scenario.name} (${(expectedBytes / 1024).toFixed(1)}KB in ${
      scenario.chunks.length
    } chunks, ${scenario.requests} requests x ${ROUNDS} rounds)`,
  );

  const best: Record<Mode, number> = { render: 0, body: 0 };
  const servers = {} as Record<Mode, http.Server>;
  for (const mode of ["render", "body"] as const) {
    servers[mode] = await createServer(mode, scenario.chunks);
    const { port } = servers[mode].address() as AddressInfo;
    // Sanity check the payload, then warm up.
    const response = await fetch(`http://localhost:${port}/`);
    assert.equal(await response.text(), html);
    assert.equal(
      response.headers.get("content-type"),
      "text/html;charset=UTF-8",
    );
    await timeBatch(port, Math.ceil(scenario.requests / 4), expectedBytes);
  }

  // Alternate modes across rounds so GC and JIT noise spreads evenly.
  for (let round = 0; round < ROUNDS; round++) {
    for (const mode of ["render", "body"] as const) {
      const { port } = servers[mode].address() as AddressInfo;
      const { seconds, bytes } = await timeBatch(
        port,
        scenario.requests,
        expectedBytes,
      );
      const rps = scenario.requests / seconds;
      best[mode] = Math.max(best[mode], rps);
      console.log(
        `  ${mode.padEnd(6)} round ${round + 1}: ${rps.toFixed(0).padStart(6)} req/s  ${(
          bytes /
          1e6 /
          seconds
        ).toFixed(1)} MB/s`,
      );
    }
  }

  console.log(
    `  => render is ${(best.render / best.body).toFixed(2)}x body throughput ` +
      `(best of ${ROUNDS}: ${best.render.toFixed(0)} vs ${best.body.toFixed(0)} req/s)`,
  );
  for (const mode of ["render", "body"] as const) {
    await new Promise((resolve) => servers[mode].close(resolve));
  }
}
