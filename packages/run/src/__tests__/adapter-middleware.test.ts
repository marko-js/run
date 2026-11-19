import assert from "assert";
import http from "http";
import net, { type AddressInfo } from "net";

import {
  copyResponseHeaders,
  createMiddleware,
  getBodyReader,
  type NodeMiddlewareOptions,
} from "../adapter/middleware";
import type { Fetch } from "../runtime";

const kRender = Symbol.for("@marko/run.render");
const encoder = new TextEncoder();

// The render and the body carry different payloads on purpose, so tests can
// tell which source was picked.
function pageResponse(render: string[], body: string[]) {
  const iterable = (async function* () {
    yield* render;
  })();
  const response = new Response(
    new ReadableStream({
      pull(ctrl) {
        for (const chunk of body) {
          ctrl.enqueue(encoder.encode(chunk));
        }
        ctrl.close();
      },
    }),
  );
  (response as any)[kRender] = { render: iterable, body: response.body };
  return response;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function serve(fetch: Fetch<any>, options?: NodeMiddlewareOptions) {
  const server = http.createServer(createMiddleware(fetch, options));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function serveWithNext(fetch: Fetch<any>) {
  const handled = deferred();
  let passedToNext: unknown;
  let statusCodeAtNext: number | undefined;
  const middleware = createMiddleware(fetch);
  const server = http.createServer((req, res) => {
    middleware(req, res, (err) => {
      passedToNext = err;
      statusCodeAtNext = res.statusCode;
      res.statusCode = 500;
      res.end("next");
      handled.resolve();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    handled: handled.promise,
    get passedToNext() {
      return passedToNext;
    },
    get statusCodeAtNext() {
      return statusCodeAtNext;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function collect(reader: ReturnType<typeof getBodyReader>) {
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const result = await reader!.read();
    if (result.done) break;
    out +=
      typeof result.value === "string"
        ? result.value
        : decoder.decode(result.value, { stream: true });
  }
  return out + decoder.decode();
}

describe("Adapter Middleware", () => {
  describe("copyResponseHeaders", () => {
    it("should preserve existing cookies set", () => {
      const expected = ["a=1", "b=2", "c=3", "d=4"];

      const initial = expected.slice(0, 2);
      const added = expected.slice(2);

      const response = new Response();
      for (const cookie of added) {
        response.headers.append("set-cookie", cookie);
      }

      const res = new http.ServerResponse({ method: "GET" } as any);
      res.setHeader("set-cookie", initial);

      assert.deepEqual(res.getHeader("set-cookie"), initial);

      copyResponseHeaders(res, response.headers);
      const actual = res.getHeader("set-cookie");

      assert.deepEqual(actual, expected);
    });
  });

  describe("getBodyReader", () => {
    it("should take the stashed render for an untouched page response", async () => {
      assert.equal(
        await collect(getBodyReader(pageResponse(["a", "b"], ["A", "B"]))),
        "ab",
      );
    });

    it("should read the body of a response without a render", async () => {
      assert.equal(
        await collect(getBodyReader(new Response("plain"))),
        "plain",
      );
    });

    it("should open nothing for a bodyless response", () => {
      assert.equal(getBodyReader(new Response(null, { status: 204 })), null);
    });

    it("should fall back to the body once `clone()` has teed it", async () => {
      // Cloning drains the single-use render into the two teed branches, so the
      // render no longer holds the output and the body does.
      const response = pageResponse(["a", "b"], ["A", "B"]);
      const clone = response.clone();

      assert.equal(await clone.text(), "AB");
      assert.equal(await collect(getBodyReader(response)), "AB");
    });

    it("should not take the render when something else holds the body", () => {
      const response = pageResponse(["a", "b"], ["A", "B"]);
      response.body!.getReader();

      // Refusing to open beats replaying the render for a body someone
      // else owns.
      assert.throws(() => getBodyReader(response), /locked/);
    });
  });

  describe("createMiddleware", () => {
    for (const [target, expected] of [
      ["//evil.example//", "http://127.0.0.1:{port}//evil.example//"],
      [
        "//evil.example/docs?q=1",
        "http://127.0.0.1:{port}//evil.example/docs?q=1",
      ],
      [
        "http://evil.example/docs",
        "http://127.0.0.1:{port}/http://evil.example/docs",
      ],
    ]) {
      it(`should keep the server origin for the request target ${target}`, async () => {
        let url = "";
        const server = await serve(async (request) => {
          url = request.url;
          return new Response(null, { status: 204 });
        });

        try {
          await new Promise<void>((resolve, reject) =>
            http
              .request({ port: server.port, host: "127.0.0.1", path: target })
              .on("response", (res) => res.resume().on("end", resolve))
              .on("error", reject)
              .end(),
          );
          assert.equal(url, expected.replace("{port}", String(server.port)));
        } finally {
          await server.close();
        }
      });
    }

    describe("origin headers", () => {
      function send(port: number, headers: Record<string, string>) {
        return new Promise<number>((resolve, reject) =>
          http
            .request({ port, host: "127.0.0.1", path: "/public", headers })
            .on("response", (res) => {
              res.resume().on("end", () => resolve(res.statusCode!));
            })
            .on("error", reject)
            .end(),
        );
      }

      const rejected: [string, Record<string, string>][] = [
        ["a path in Host", { host: "localhost/admin?" }],
        ["a port and fragment in Host", { host: "localhost:80/admin#" }],
        ["a backslash in Host", { host: "evil.example\\admin?" }],
        ["a query in Host", { host: "localhost?" }],
        ["a fragment in Host", { host: "localhost#" }],
        ["userinfo in Host", { host: "user:pass@localhost" }],
        ["a tab in Host", { host: "local\thost" }],
        ["an out of range port in Host", { host: "localhost:99999" }],
        ["a malformed IPv6 literal in Host", { host: "[:::]" }],
        ["a percent escape in Host", { host: "local%2fhost" }],
        [
          "a path in X-Forwarded-Host",
          { "x-forwarded-host": "localhost/admin?" },
        ],
        ["a script protocol", { "x-forwarded-proto": "javascript" }],
        [
          "a protocol with a path",
          { "x-forwarded-proto": "https://evil.example/?" },
        ],
      ];

      for (const [name, headers] of rejected) {
        it(`should answer 400 without calling fetch for ${name}`, async () => {
          let called = false;
          const server = await serve(
            async () => {
              called = true;
              return new Response(null, { status: 204 });
            },
            { trustProxy: true },
          );

          try {
            assert.equal(await send(server.port, headers), 400);
            assert.equal(called, false);
          } finally {
            await server.close();
          }
        });
      }

      it("should answer 400 without passing the error to next", async () => {
        const server = await serveWithNext(async () => new Response(null));

        try {
          const status = await send(server.port, { host: "localhost?" });
          assert.equal(status, 400);
          assert.equal(server.passedToNext, undefined);
        } finally {
          await server.close();
        }
      });

      it("should answer 400 when Host is missing outside development", async () => {
        let called = false;
        const server = await serve(async () => {
          called = true;
          return new Response(null, { status: 204 });
        });

        try {
          // HTTP/1.0 because node itself answers an HTTP/1.1 request without Host.
          const head = await new Promise<string>((resolve, reject) => {
            let data = "";
            const socket = net.connect(server.port, "127.0.0.1", () =>
              socket.end("GET /public HTTP/1.0\r\n\r\n"),
            );
            socket
              .setEncoding("utf8")
              .on("data", (chunk) => (data += chunk))
              .on("end", () => resolve(data))
              .on("error", reject);
          });
          assert.match(head, /^HTTP\/1\.1 400 /);
          assert.equal(called, false);
        } finally {
          await server.close();
        }
      });

      const accepted: [
        string,
        Record<string, string>,
        string,
        NodeMiddlewareOptions?,
      ][] = [
        [
          "a host and port",
          { host: "localhost:3000" },
          "http://localhost:3000/public",
        ],
        [
          "a port with leading zeros",
          { host: "localhost:00080" },
          "http://localhost/public",
        ],
        ["an IPv6 literal", { host: "[::1]:3000" }, "http://[::1]:3000/public"],
        [
          "a mixed case host",
          { host: "LOCALHOST:80" },
          "http://localhost/public",
        ],
        [
          "a forwarded protocol and host",
          {
            "x-forwarded-proto": "HTTPS",
            "x-forwarded-host": "example.com:8443",
          },
          "https://example.com:8443/public",
          { trustProxy: true },
        ],
        [
          "a padded forwarded host list",
          { "x-forwarded-host": "example.com , other.example" },
          "http://example.com/public",
          { trustProxy: true },
        ],
        [
          "a configured origin with an invalid Host",
          { host: "localhost/admin?" },
          "http://app.example/public",
          { origin: "http://app.example" },
        ],
      ];

      for (const [name, headers, expected, options] of accepted) {
        it(`should derive the origin from ${name}`, async () => {
          let url = "";
          const server = await serve(async (request) => {
            url = request.url;
            return new Response(null, { status: 204 });
          }, options);

          try {
            assert.equal(await send(server.port, headers), 204);
            assert.equal(url, expected);
          } finally {
            await server.close();
          }
        });
      }
    });

    it("should pass createPlatform the request handed to fetch and fetch its result", async () => {
      let platformRequest: Request | undefined;
      let fetchRequest: Request | undefined;
      let fetchPlatform: unknown;
      const server = await serve(
        async (request, platform) => {
          fetchRequest = request;
          fetchPlatform = platform;
          return new Response(null, { status: 204 });
        },
        {
          createPlatform(node, request) {
            platformRequest = request;
            return { nodeRequest: !!node.request, custom: true };
          },
        },
      );

      try {
        await new Promise<void>((resolve, reject) =>
          http
            .request({
              port: server.port,
              host: "127.0.0.1",
              path: "//evil.example/x",
            })
            .on("response", (res) => res.resume().on("end", resolve))
            .on("error", reject)
            .end(),
        );
        assert.equal(platformRequest, fetchRequest);
        assert.equal(
          platformRequest!.url,
          `http://127.0.0.1:${server.port}//evil.example/x`,
        );
        assert.deepEqual(fetchPlatform, { nodeRequest: true, custom: true });
      } finally {
        await server.close();
      }
    });

    it("should abort the request signal and cancel an idle stream when the client disconnects", async () => {
      const cancelled = deferred();
      let signal!: AbortSignal;
      let cancelReason = "not cancelled";

      // Flushes one chunk then goes idle: nothing pulls again, so only the
      // abort can end it.
      const server = await serve(async (request) => {
        signal = request.signal;
        return new Response(
          new ReadableStream({
            start(ctrl) {
              ctrl.enqueue(encoder.encode("open\n"));
            },
            cancel(reason) {
              cancelReason = String(reason);
              cancelled.resolve();
            },
          }),
        );
      });

      try {
        const req = http.request({ port: server.port, host: "127.0.0.1" });
        req.end();

        const res = await new Promise<http.IncomingMessage>((resolve) =>
          req.on("response", resolve),
        );
        await new Promise<void>((resolve) => res.once("data", () => resolve()));

        assert.equal(signal.aborted, false, "not aborted while connected");

        req.destroy();
        await cancelled.promise;

        assert.equal(signal.aborted, true);
        assert.notEqual(cancelReason, "not cancelled");
      } finally {
        await server.close();
      }
    });

    it("should cancel the body of a response resolved after the client disconnected", async () => {
      const cancelled = deferred();
      const reachedHandler = deferred();
      let cancelWasCalled = false;

      // Resolves only after the disconnect, so the early return is the only
      // place this stream can be released.
      const server = await serve(async (request) => {
        reachedHandler.resolve();
        await new Promise<void>((resolve) =>
          request.signal.addEventListener("abort", () => resolve(), {
            once: true,
          }),
        );
        return new Response(
          new ReadableStream({
            cancel() {
              cancelWasCalled = true;
              cancelled.resolve();
            },
          }),
        );
      });

      try {
        const req = http.request({ port: server.port, host: "127.0.0.1" });
        // Destroying pre-response errors the client request; expected here.
        req.on("error", () => {});
        req.end();

        await reachedHandler.promise;
        req.destroy();
        await cancelled.promise;

        assert.equal(cancelWasCalled, true);
      } finally {
        await server.close();
      }
    });

    it("should not abort the signal when the response completes normally", async () => {
      const closed = deferred();
      let signal!: AbortSignal;

      // The middleware's own `close` listener registers first, so once this
      // one fires the abort decision has already been made.
      const server = await serve(async (request, platform) => {
        signal = request.signal;
        platform.response.on("close", closed.resolve);
        return new Response("done");
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "done");

        await closed.promise;
        assert.equal(signal.aborted, false);
      } finally {
        await server.close();
      }
    });

    it("should not describe the error response with the head of a response that failed before sending it", async () => {
      // A render that throws before its first chunk, with a head an error
      // handler must not inherit (Express falls back to a 4xx/5xx status).
      const server = await serveWithNext(
        async () =>
          new Response(
            new ReadableStream({
              pull(ctrl) {
                ctrl.error(new Error("render failed"));
              },
            }),
            {
              status: 404,
              headers: {
                "cache-control": "public, max-age=3600",
                "content-type": "application/json",
                "set-cookie": "session=1",
              },
            },
          ),
      );

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "next");
        assert.equal(server.statusCodeAtNext, 200);
        assert.equal(response.headers.get("cache-control"), null);
        assert.equal(response.headers.get("content-type"), null);
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal((server.passedToNext as Error).message, "render failed");
      } finally {
        await server.close();
      }
    });

    it("should leave an earlier header to the error response when the body fails first", async () => {
      // A header set before the response's head (as an earlier middleware
      // does) keeps its value when the response it shares a name with fails.
      const server = await serveWithNext(async (_request, platform) => {
        platform.response.setHeader("x-frame-options", "DENY");
        return new Response(
          new ReadableStream({
            pull(ctrl) {
              ctrl.error(new Error("render failed"));
            },
          }),
          { headers: { "x-frame-options": "SAMEORIGIN" } },
        );
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "next");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
      } finally {
        await server.close();
      }
    });

    it("should leave a response sent while the first chunk was pending to its sender", async () => {
      const cancelled = deferred();

      // A zero high-water mark defers `pull` to the middleware's first read,
      // so the response is ended (as a timeout would) while that read is pending.
      const server = await serveWithNext(async (_request, platform) => {
        return new Response(
          new ReadableStream(
            {
              pull(ctrl) {
                platform.response.end("timeout");
                ctrl.enqueue(encoder.encode("late"));
              },
              cancel() {
                cancelled.resolve();
              },
            },
            { highWaterMark: 0 },
          ),
          { headers: { "x-late": "1" } },
        );
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "timeout");
        assert.equal(response.headers.get("x-late"), null);

        await cancelled.promise;
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(server.passedToNext, undefined);
      } finally {
        await server.close();
      }
    });

    it("should pass a non-Error throw to next as an Error", async () => {
      // A null-prototype object has no primitive conversion, so building the
      // message out of the thrown value would throw inside the error path.
      const server = await serveWithNext(async () => {
        throw Object.create(null);
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "next");
        await server.handled;

        const error = server.passedToNext;
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Unknown error handling request");
      } finally {
        await server.close();
      }
    });
  });
});
