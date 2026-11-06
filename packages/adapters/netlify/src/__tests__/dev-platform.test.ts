import assert from "assert";
import type { IncomingMessage, ServerResponse } from "http";

import { createDevPlatform, isFallthrough } from "../dev-platform";

describe("Netlify dev platform", () => {
  it("should read the url and cookies from the web request", () => {
    const request = new Request("http://localhost:3000//evil.example/x", {
      headers: { cookie: "theme=dark; visited=yes" },
    });
    const context = createDevPlatform(
      {
        request: { socket: { remoteAddress: "::1" } } as IncomingMessage,
        response: {} as ServerResponse,
      },
      request,
    );
    assert.equal(context.url.href, request.url);
    assert.equal(context.cookies.get("visited"), "yes");
    assert.equal(context.ip, "::1");
  });

  it("should skip a cookie set after the response headers were sent", () => {
    const warn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (message: unknown) => warnings.push(message);
    try {
      const context = createDevPlatform(
        {
          request: { socket: {} } as IncomingMessage,
          response: {
            headersSent: true,
            appendHeader() {
              throw new Error("ERR_HTTP_HEADERS_SENT");
            },
          } as unknown as ServerResponse,
        },
        new Request("http://localhost:3000/"),
      );
      context.cookies.set("visited", "yes");
      context.cookies.delete("theme");
      assert.equal(warnings.length, 2);
    } finally {
      console.warn = warn;
    }
  });

  it("should read a cookie despite a malformed one, and keep the first of a name", () => {
    const context = createDevPlatform(
      {
        request: { socket: {} } as IncomingMessage,
        response: {} as ServerResponse,
      },
      new Request("http://localhost:3000/", {
        headers: { cookie: "progress=100%; theme=dark; theme=light" },
      }),
    );
    assert.equal(context.cookies.get("progress"), "100%");
    assert.equal(context.cookies.get("theme"), "dark");
  });

  it("should mark the response next() resolves to as a fallthrough", async () => {
    const context = createDevPlatform(
      {
        request: { socket: {} } as IncomingMessage,
        response: {} as ServerResponse,
      },
      new Request("http://localhost:3000/"),
    );
    const response = await context.next();
    assert.equal(response.status, 404);
    assert.ok(isFallthrough(response));
    assert.ok(!isFallthrough(new Response(null, { status: 404 })));
  });
});
