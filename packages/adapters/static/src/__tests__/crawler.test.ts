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
        "http://localhost//evil.example/x",
      ]);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
