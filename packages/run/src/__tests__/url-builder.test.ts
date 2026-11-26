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

// The client-build rewrite hands `Run.href(path, opts)` to these helpers
// without `href`'s own nullish guard, so they must tolerate it themselves.
describe("rejected path segments", () => {
  const invalid = /Invalid param/;

  it("rejects an empty param that is not last", () => {
    assert.throws(() => href_path`/${""}/${"evil.com"}`, invalid);
  });

  it("rejects an empty param before static text", () => {
    assert.throws(() => href_path`/${""}/x`, invalid);
  });

  it("rejects an empty catch-all item", () => {
    assert.throws(() => href_path`/${["", "evil.com"]}`, invalid);
    assert.throws(() => href_path`/a/${["b", ""]}`, invalid);
  });

  it("rejects an empty catch-all that is not last", () => {
    assert.throws(() => href_path`/${[]}/${"evil.com"}`, invalid);
    assert.throws(
      () => href("/$a/x" as any, { params: { a: [] } } as any),
      invalid,
    );
  });

  it("rejects a missing param", () => {
    for (const missing of [undefined, null] as any[]) {
      assert.throws(() => href_path`/a/${missing}/b`, invalid);
      assert.throws(() => href_path`/docs/${missing}`, invalid);
      assert.throws(() => href_path`/tags/${["a", missing]}`, invalid);
      assert.throws(
        () => href("/$a" as any, { params: { a: missing } } as any),
        invalid,
      );
    }
    assert.equal(href_path`/a/${0}`, "/a/0");
  });

  it("rejects dot segments", () => {
    assert.throws(() => href_path`/admin/${".."}/x`, invalid);
    assert.throws(() => href_path`/admin/${"."}`, invalid);
    assert.throws(() => href_path`/tags/${["a", ".."]}`, invalid);
  });

  it("rejects through every helper", () => {
    const options = { params: { a: "", b: "evil.com" } };
    assert.throws(() => href("/$a/$b" as any, options as any), invalid);
    assert.throws(() => href_keys`${options}/${"a"}/${"b"}`, invalid);
    assert.throws(() => href_values`${{}}/${""}/${"b"}`, invalid);
  });

  it("allows an empty final param so a catch-all can link to its parent", () => {
    assert.equal(href_path`/docs/${""}`, "/docs/");
    assert.equal(href_path`/docs/${[]}`, "/docs/");
    assert.equal(href_path`/docs/${[""]}`, "/docs/");
  });

  it("keeps dots inside a longer segment", () => {
    assert.equal(href_path`/files/${"a.b"}/${"..."}`, "/files/a.b/...");
  });
});

describe("nullish options", () => {
  it("href returns the path for a nullish options argument", () => {
    assert.equal(href("/about", undefined as any), "/about");
  });

  it("href_keys tolerates nullish options for a param-less path", () => {
    const opts = undefined as any;
    assert.equal(href_keys`${opts}/about`, "/about");
  });

  it("href_values tolerates nullish spread options", () => {
    const defaults = undefined as any;
    assert.equal(href_values`${defaults}/users/${1}`, "/users/1");
  });
});

describe("nullish search values", () => {
  it("omits undefined search entries and keeps null as a value", () => {
    assert.equal(
      href("/about", {
        search: { q: "hi", page: undefined, tag: null },
      }),
      "/about?q=hi&tag=null",
    );
  });

  it("drops the query entirely when every entry is undefined", () => {
    assert.equal(href("/about", { search: { page: undefined } }), "/about");
  });

  it("keeps falsy but defined values", () => {
    assert.equal(
      href("/about", { search: { q: "", n: 0 } } as any),
      "/about?q=&n=0",
    );
  });

  it("applies through the rewritten helper tiers", () => {
    const opts = { params: { id: 1 }, search: { q: "x", page: undefined } };
    assert.equal(href_keys`${opts}/users/${"id"}`, "/users/1?q=x");
    assert.equal(
      href_values`${{ search: { tag: null } }}/users/${2}`,
      "/users/2?tag=null",
    );
  });
});

describe("array search values", () => {
  it("repeats the key for each item", () => {
    assert.equal(
      href("/about", { search: { tag: ["a", "b"], q: "hi" } } as any),
      "/about?tag=a&tag=b&q=hi",
    );
  });

  it("keeps a single item as a plain value", () => {
    assert.equal(
      href("/about", { search: { tag: ["a"] } } as any),
      "/about?tag=a",
    );
  });

  it("omits an empty array and drops the query when nothing remains", () => {
    assert.equal(href("/about", { search: { tag: [] } } as any), "/about");
    assert.equal(
      href("/about", { search: { tag: [], q: "hi" } } as any),
      "/about?q=hi",
    );
  });

  it("skips undefined items", () => {
    assert.equal(
      href("/about", { search: { tag: ["a", undefined, "b"] } } as any),
      "/about?tag=a&tag=b",
    );
  });

  it("keeps null items as a value", () => {
    assert.equal(
      href("/about", { search: { tag: ["a", null, "b"] } }),
      "/about?tag=a&tag=null&tag=b",
    );
  });

  it("encodes each item", () => {
    assert.equal(
      href("/about", { search: { tag: ["x y", 1] } } as any),
      "/about?tag=x%20y&tag=1",
    );
  });

  it("applies through the rewritten helper tiers", () => {
    const opts = { params: { id: 1 }, search: { tag: ["a", "b"] } };
    assert.equal(href_keys`${opts}/users/${"id"}`, "/users/1?tag=a&tag=b");
    assert.equal(
      href_values`${{ search: { tag: ["a", "b"] } }}/users/${2}`,
      "/users/2?tag=a&tag=b",
    );
  });
});

describe("search value encoding", () => {
  it("percent-encodes keys and values", () => {
    assert.equal(
      href("/about", { search: { "a b": "x&y=z#w" } } as any),
      "/about?a%20b=x%26y%3Dz%23w",
    );
  });
});
