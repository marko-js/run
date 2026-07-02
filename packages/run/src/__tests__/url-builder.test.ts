import assert from "assert";

import {
  href,
  href_keys,
  href_path,
  href_values,
} from "../runtime/url-builder";

declare module "../runtime/types" {
  interface App extends DefineRoutes {}
}

describe("url-builder", () => {
  describe("href", () => {
    it("should return path as-is when no params are needed", () => {
      const actual = href("/foo/bar/baz");
      assert.equal(actual, "/foo/bar/baz");
    });

    it("should replace a single path param", () => {
      const actual = href("/users/$id", { params: { id: 42 } });
      assert.equal(actual, "/users/42");
    });

    it("should replace a param at the end of the path", () => {
      const actual = href("/users/$id", { params: { id: "abc" } });
      assert.equal(actual, "/users/abc");
    });

    it("should encode special characters in param values", () => {
      const actual = href("/search/$query", {
        params: { query: "hello world" },
      });
      assert.equal(actual, "/search/hello%20world");
    });

    it("should encode slashes in param values", () => {
      const actual = href("/files/$name", { params: { name: "a/b" } });
      assert.equal(actual, "/files/a%2Fb");
    });

    it("should handle numeric param values", () => {
      const actual = href("/items/$id/details/$version", {
        params: { id: 0, version: 99 },
      });
      assert.equal(actual, "/items/0/details/99");
    });

    it("should handle rest params with $$", () => {
      const actual = href("/files/$$path", {
        params: { path: "docs/readme" },
      });
      assert.equal(actual, "/files/docs%2Freadme");
    });

    it("should handle array param values for rest params", () => {
      const actual = href("/tags/$$items", {
        params: { items: ["a", "b", "c"] },
      });
      assert.equal(actual, "/tags/a/b/c");
    });

    it("should preserve leading static segments with trailing param", () => {
      const actual = href("/api/v2/$resource", {
        params: { resource: "users" },
      });
      assert.equal(actual, "/api/v2/users");
    });

    it("should handle param surrounded by static segments", () => {
      const actual = href("/a/$x/b", { params: { x: "val" } });
      assert.equal(actual, "/a/val/b");
    });

    it("should append search params", () => {
      const opts = { params: { id: 1 }, search: { page: "2" } };
      const actual = href("/users/$id", opts);
      assert.equal(actual, "/users/1?page=2");
    });

    it("should append hash", () => {
      const actual = href("/docs", { hash: "section" });
      assert.equal(actual, "/docs#section");
    });

    it("should append a numeric zero hash", () => {
      const actual = href("/docs", { hash: 0 });
      assert.equal(actual, "/docs#0");
    });

    it("should look up escaped param names by their unescaped key", () => {
      const actual = href("/thing/$`$id`/$foo", {
        params: { $id: "a", foo: "b" },
      });
      assert.equal(actual, "/thing/a/b");
    });

    it("should combine params, search, and hash", () => {
      const opts = {
        params: { id: 5 },
        search: { tab: "posts" },
        hash: "top",
      };
      const actual = href("/users/$id", opts);
      assert.equal(actual, "/users/5?tab=posts#top");
    });
  });

  describe("href_path", () => {
    it("should return a static path with no params", () => {
      const actual = href_path`/foo/bar`;
      assert.equal(actual, "/foo/bar");
    });

    it("should substitute a single param value", () => {
      const actual = href_path`/users/${42}`;
      assert.equal(actual, "/users/42");
    });

    it("should substitute a string param value", () => {
      const actual = href_path`/users/${"abc"}`;
      assert.equal(actual, "/users/abc");
    });

    it("should encode special characters in param values", () => {
      const actual = href_path`/search/${"hello world"}`;
      assert.equal(actual, "/search/hello%20world");
    });

    it("should encode slashes in param values", () => {
      const actual = href_path`/files/${"a/b"}`;
      assert.equal(actual, "/files/a%2Fb");
    });

    it("should substitute multiple params", () => {
      const actual = href_path`/users/${"5"}/posts/${"99"}`;
      assert.equal(actual, "/users/5/posts/99");
    });

    it("should handle array values for rest params", () => {
      const actual = href_path`/tags/${["a", "b", "c"]}`;
      assert.equal(actual, "/tags/a/b/c");
    });

    it("should handle param with trailing static segment", () => {
      const actual = href_path`/a/${"val"}/b`;
      assert.equal(actual, "/a/val/b");
    });

    it("should handle numeric param value 0", () => {
      const actual = href_path`/items/${0}/details/${99}`;
      assert.equal(actual, "/items/0/details/99");
    });
  });

  describe("href_values", () => {
    it("should build a path with no params and no options", () => {
      const actual = href_values`${{}}/foo/bar`;
      assert.equal(actual, "/foo/bar");
    });

    it("should substitute a single param value", () => {
      const actual = href_values`${{}}/users/${42}`;
      assert.equal(actual, "/users/42");
    });

    it("should substitute a string param value", () => {
      const actual = href_values`${{}}/users/${"abc"}`;
      assert.equal(actual, "/users/abc");
    });

    it("should encode special characters in param values", () => {
      const actual = href_values`${{}}/search/${"hello world"}`;
      assert.equal(actual, "/search/hello%20world");
    });

    it("should substitute multiple params", () => {
      const actual = href_values`${{}}/users/${"5"}/posts/${"99"}`;
      assert.equal(actual, "/users/5/posts/99");
    });

    it("should handle array values for rest params", () => {
      const actual = href_values`${{}}/tags/${["a", "b", "c"]}`;
      assert.equal(actual, "/tags/a/b/c");
    });

    it("should append search params from options", () => {
      const actual = href_values`${{ search: { page: "2" } }}/users/${1}`;
      assert.equal(actual, "/users/1?page=2");
    });

    it("should append hash from options", () => {
      const actual = href_values`${{ hash: "section" }}/docs`;
      assert.equal(actual, "/docs#section");
    });

    it("should handle search and hash together", () => {
      const actual = href_values`${{ search: { tab: "posts" }, hash: "top" }}/users/${"5"}`;
      assert.equal(actual, "/users/5?tab=posts#top");
    });

    it("should handle 0 (no options) correctly", () => {
      const actual = href_values`${{}}/test`;
      assert.equal(actual, "/test");
    });

    it("should handle param with trailing static segment", () => {
      const actual = href_values`${{}}/a/${"val"}/b`;
      assert.equal(actual, "/a/val/b");
    });

    it("should encode numeric param value 0", () => {
      const actual = href_values`${{}}/items/${0}/details/${99}`;
      assert.equal(actual, "/items/0/details/99");
    });
  });

  describe("href_keys", () => {
    it("should look up a single param by key", () => {
      const opts = { params: { id: "42" } };
      const actual = href_keys`${opts}/users/${"id"}`;
      assert.equal(actual, "/users/42");
    });

    it("should look up multiple params by key", () => {
      const opts = { params: { id: "5", postId: "99" } };
      const actual = href_keys`${opts}/users/${"id"}/posts/${"postId"}`;
      assert.equal(actual, "/users/5/posts/99");
    });

    it("should encode param values", () => {
      const opts = { params: { query: "hello world" } };
      const actual = href_keys`${opts}/search/${"query"}`;
      assert.equal(actual, "/search/hello%20world");
    });

    it("should handle array values for rest params", () => {
      const opts = { params: { items: ["a", "b", "c"] } };
      const actual = href_keys`${opts}/tags/${"items"}`;
      assert.equal(actual, "/tags/a/b/c");
    });

    it("should append search from options", () => {
      const opts = { params: { id: 1 }, search: { page: "2" } };
      const actual = href_keys`${opts}/users/${"id"}`;
      assert.equal(actual, "/users/1?page=2");
    });

    it("should append hash from options", () => {
      const opts = { params: { id: 1 }, hash: "top" };
      const actual = href_keys`${opts}/users/${"id"}`;
      assert.equal(actual, "/users/1#top");
    });

    it("should handle params, search, and hash", () => {
      const opts = {
        params: { id: 5 },
        search: { tab: "posts" },
        hash: "top",
      };
      const actual = href_keys`${opts}/users/${"id"}`;
      assert.equal(actual, "/users/5?tab=posts#top");
    });

    it("should handle numeric param values", () => {
      const opts = { params: { id: 0, version: 99 } };
      const actual = href_keys`${opts}/items/${"id"}/details/${"version"}`;
      assert.equal(actual, "/items/0/details/99");
    });

    it("should handle param with trailing static segment", () => {
      const opts = { params: { x: "val" } };
      const actual = href_keys`${opts}/a/${"x"}/b`;
      assert.equal(actual, "/a/val/b");
    });
  });
});
