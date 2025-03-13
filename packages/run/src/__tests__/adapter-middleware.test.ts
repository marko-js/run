import assert from "assert";
import http from "http";

import { copyResponseHeaders } from "../adapter/middleware";

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
});
