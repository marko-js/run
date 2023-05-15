import { OutgoingMessage } from "http";
import { setResponseHeaders } from "../adapter/middleware";
import assert from "assert";

describe("Adapter Middleware", () => {
  describe("setResponseHeaders", () => {
    it("should should split comma separated set-cookie headers", () => {
      const expected = ["a=1", "b=2"];
      const res = new OutgoingMessage();
      const response = new Response(null, {
        headers: new Headers({
          "set-cookie": expected.join(","),
        }),
      });
      setResponseHeaders(response, res);

      const actual = res.getHeader("set-cookie");
      assert(Array.isArray(actual), "set-cookie header should be an array");
      assert.equal(
        actual[0],
        expected[0],
        `set-cookie header should contain '${expected[0]}'`
      );
      assert.equal(
        actual[1],
        expected[1],
        `set-cookie header should contain '${expected[1]}'`
      );
      assert.equal(
        actual.length,
        2,
        "set-cookie header should contain 2 cookies"
      );
    });

    it("should should not split on commas in the expires date", () => {
      const expected = [
        "a=1; Expires = Fri, 15 Jun 2023 12:00:00 GMT; path=/mon",
        "b=2; Expires=Sat, 15 May 2023 18:00:00 GMT",
      ];
      const res = new OutgoingMessage();
      const response = new Response(null, {
        headers: new Headers({
          "set-cookie": expected.join(","),
        }),
      });
      setResponseHeaders(response, res);

      const actual = res.getHeader("set-cookie");
      assert(Array.isArray(actual), "set-cookie header should be an array");
      assert.equal(
        actual[0],
        expected[0],
        `set-cookie header should contain '${expected[0]}'`
      );
      assert.equal(
        actual[1],
        expected[1],
        `set-cookie header should contain '${expected[1]}'`
      );
      assert.equal(
        actual.length,
        2,
        "set-cookie header should contain 2 cookies"
      );
    });
  });
});
