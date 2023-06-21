import { getSetCookie_fallback } from "../adapter/middleware";
import assert from "assert";

describe("Adapter Middleware", () => {
  describe("getSetCookie_fallback", () => {
    it("should should split comma separated set-cookie headers", () => {
      const expected = ["a=1", "b=2"];
      const response = new Response();
      for (const cookie of expected) {
        response.headers.append("set-cookie", cookie);
      }
      const actual = getSetCookie_fallback(response.headers)
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
      const response = new Response();
      for (const cookie of expected) {
        response.headers.append("set-cookie", cookie);
      }
      const actual = getSetCookie_fallback(response.headers);
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

    it("should return a string when one cookie", () => {
      const expected = "a=1";
      const response = new Response();
      response.headers.append("set-cookie", expected);
      const actual = getSetCookie_fallback(response.headers)
      assert.equal(
        actual,
        expected,
        `set-cookie header should equal '${expected}'`
      );
    });

    it("should return a string when one cookie with expiration", () => {
      const expected = "a=1; Expires = Fri, 15 Jun 2023 12:00:00 GMT; path=/mon";
      const response = new Response();
      response.headers.append("set-cookie", expected);
      const actual = getSetCookie_fallback(response.headers)
      assert.equal(
        actual,
        expected,
        `set-cookie header should equal '${expected}'`
      );
    });

    it("should return undefined when no cookies", () => {
      const expected = undefined
      const response = new Response();
      const actual = getSetCookie_fallback(response.headers)
      assert.equal(
        actual,
        expected,
        `set-cookie header should equal '${expected}'`
      );
    });
  });
});
