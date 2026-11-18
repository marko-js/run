import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

import createCrawler from "../crawler";

describe("Static crawler", () => {
  it("should keep the origin for a linked path that starts with //", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "crawler-"));
    const requested: string[] = [];
    const crawler = createCrawler(
      async (request) => {
        requested.push(request.url);
        return new Response('<a href="/.//evil.example/x">link</a>', {
          headers: { "content-type": "text/html" },
        });
      },
      { out },
    );

    try {
      await crawler.crawl(["/"]);
      assert.deepEqual(requested, [
        "http://localhost/",
        "http://localhost/evil.example/x",
      ]);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
  describe("redirect pages", () => {
    const cases: [string, string, string | undefined][] = [
      ["same-origin path", "/docs/", "/docs/"],
      [
        "same-origin path with query and hash",
        "/a?b=1&c=2#d",
        "/a?b=1&amp;c=2#d",
      ],
      [
        "same-origin path that starts with //",
        "http://localhost//evil.example",
        "/.//evil.example",
      ],
      [
        "off-origin https",
        "https://example.com/a?b=1&c=2",
        "https://example.com/a?b=1&amp;c=2",
      ],
      ["off-origin protocol-relative", "//example.com/a", "//example.com/a"],
      [
        "quote in the target",
        'https://example.com/"x',
        "https://example.com/&quot;x",
      ],
      ["javascript scheme", "javascript:alert(1)", undefined],
      ["javascript scheme with a tab", "java\tscript:alert(1)", undefined],
      ["backslashes", "\\\\example.com/a", "\\\\example.com/a"],
      ["https with one slash", "https:/example.com/a", "https:/example.com/a"],
      [
        "http with one slash, which is relative to the site",
        "http:/example.com/a",
        "/example.com/a",
      ],
      ["data scheme", "data:text/html,hi", undefined],
    ];

    for (const [name, location, expected] of cases) {
      it(`should write ${expected === undefined ? "no page" : "a refresh"} for ${name}`, async () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), "crawler-"));
        const crawler = createCrawler(
          async (request) =>
            new URL(request.url).pathname === "/r"
              ? new Response(null, { status: 302, headers: { location } })
              : new Response(null, { status: 204 }),
          { out },
        );

        try {
          const { redirect } = await crawler.crawl(["/r"]);
          const file = path.join(out, "r.html");
          assert.equal(redirect[0].ok, true);
          if (expected === undefined) {
            assert.equal(fs.existsSync(file), false);
          } else {
            assert.equal(
              fs.readFileSync(file, "utf8"),
              `<!DOCTYPE html><meta http-equiv=Refresh content="0;url=${expected}">`,
            );
          }
        } finally {
          fs.rmSync(out, { recursive: true, force: true });
        }
      });
    }
  });

  it("should crawl a path with an empty segment as the path without it", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "crawler-"));
    const requested: string[] = [];
    const crawler = createCrawler(
      async (request) => {
        const { pathname } = new URL(request.url);
        requested.push(pathname);
        if (pathname === "/") {
          return new Response('<a href="/x/">a</a><a href="/.//x/">b</a>', {
            headers: { "content-type": "text/html" },
          });
        }

        if (pathname === "/x/") {
          return new Response("real page", {
            headers: { "content-type": "text/html" },
          });
        }

        // Answers last, so an overwrite would be the final write.
        await new Promise((resolve) => setTimeout(resolve, 30));
        return new Response(null, {
          status: 302,
          headers: { location: "https://example.com/" },
        });
      },
      { out },
    );

    try {
      await crawler.crawl(["/"]);
      assert.deepEqual(requested.sort(), ["/", "/x/"]);
      assert.equal(
        fs.readFileSync(path.join(out, "x", "index.html"), "utf8"),
        "real page",
      );
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
