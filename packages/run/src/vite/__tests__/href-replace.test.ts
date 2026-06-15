import assert from "assert";
import { parseSync } from "oxc-parser";
import { RolldownMagicString } from "rolldown";

import { findHrefReplacements } from "../utils/href-replace";

function apply(code: string) {
  const ast = parseSync("test.js", code, {
    astType: "js",
    sourceType: "module",
  });
  const replacements = findHrefReplacements(code, ast);
  if (replacements.length) {
    const s = new RolldownMagicString(code);
    for (const { edits } of replacements) {
      for (const { start, end, code } of edits) {
        if (code) {
          s.overwrite(start, end, code);
        } else {
          s.remove(start, end);
        }
      }
    }
    return s.toString();
  }
  return code;
}

describe("href-replace", () => {
  describe("tier 0: fully static", () => {
    it("simple string literal path", () => {
      assert.equal(apply(`Run.href("/foo/bar")`), `"/foo/bar"`);
    });

    it("template literal with no expressions", () => {
      assert.equal(apply("Run.href(`/foo/bar`)"), `"/foo/bar"`);
    });

    it("single param", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { params: { id: "42" } })`),
        `"/users/42"`,
      );
    });

    it("numeric param", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { params: { id: 7 } })`),
        `"/users/7"`,
      );
    });

    it("multiple params", () => {
      assert.equal(
        apply(
          `Run.href("/users/$id/posts/$postId", { params: { id: "5", postId: "99" } })`,
        ),
        `"/users/5/posts/99"`,
      );
    });

    it("encodes special characters in param values", () => {
      assert.equal(
        apply(
          `Run.href("/search/$query", { params: { query: "hello world" } })`,
        ),
        `"/search/hello%20world"`,
      );
    });

    it("search params", () => {
      assert.equal(
        apply(`Run.href("/users", { search: { page: "2" } })`),
        `"/users?page=2"`,
      );
    });

    it("hash", () => {
      assert.equal(
        apply(`Run.href("/docs", { hash: "section" })`),
        `"/docs#section"`,
      );
    });

    it("params, search, and hash combined", () => {
      assert.equal(
        apply(
          `Run.href("/users/$id", { params: { id: "5" }, search: { tab: "posts" }, hash: "top" })`,
        ),
        `"/users/5?tab=posts#top"`,
      );
    });

    it("rest params with array", () => {
      assert.equal(
        apply(
          `Run.href("/tags/$$items", { params: { items: ["a", "b", "c"] } })`,
        ),
        `"/tags/a/b/c"`,
      );
    });

    it("negative numeric param", () => {
      assert.equal(
        apply(`Run.href("/items/$id", { params: { id: -1 } })`),
        `"/items/-1"`,
      );
    });
  });

  describe("tier 1: href_path (static path, visible params, no other options)", () => {
    it("dynamic param value", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { params: { id: getUserId() } })`),
        "href_path`/users/${getUserId()}`",
      );
    });

    it("shorthand param value", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { params: { id } })`),
        "href_path`/users/${id}`",
      );
    });

    it("multiple dynamic params", () => {
      assert.equal(
        apply(
          `Run.href("/users/$id/posts/$postId", { params: { id: a, postId: b } })`,
        ),
        "href_path`/users/${a}/posts/${b}`",
      );
    });

    it("trailing static segment", () => {
      assert.equal(
        apply(`Run.href("/a/$x/b", { params: { x: val } })`),
        "href_path`/a/${val}/b`",
      );
    });
  });

  describe("tier 1b: href_values (static path, visible params, plus other options)", () => {
    it("search/hash options preserved", () => {
      assert.equal(
        apply(
          `Run.href("/users/$id", { params: { id: userId }, search: s, hash: h })`,
        ),
        "href_values`${{ search: s, hash: h }}/users/${userId}`",
      );
    });

    it("options object with spread before params", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { ...defaults, params: { id: "1" } })`),
        'href_values`${defaults}/users/${"1"}`',
      );
    });
  });

  describe("tier 2: href_keys (static path, opaque options)", () => {
    it("options is a variable", () => {
      assert.equal(
        apply(`Run.href("/users/$id", opts)`),
        'href_keys`${opts}/users/${"id"}`',
      );
    });

    it("options is a function call", () => {
      assert.equal(
        apply(`Run.href("/users/$id", getOpts())`),
        'href_keys`${getOpts()}/users/${"id"}`',
      );
    });

    it("multiple params", () => {
      assert.equal(
        apply(`Run.href("/users/$id/posts/$postId", opts)`),
        'href_keys`${opts}/users/${"id"}/posts/${"postId"}`',
      );
    });

    it("path with no params", () => {
      assert.equal(
        apply(`Run.href("/users", opts)`),
        "href_keys`${opts}/users`",
      );
    });

    it("computed property keys", () => {
      assert.equal(
        apply(`Run.href("/users/$id", { [key]: { id: "1" } })`),
        'href_keys`${{ [key]: { id: "1" } }}/users/${"id"}`',
      );
    });
  });

  describe("fallback: href (dynamic path)", () => {
    it("variable path", () => {
      assert.equal(apply(`Run.href(path)`), "href(path)");
    });

    it("template literal with expressions", () => {
      assert.equal(apply("Run.href(`/users/${id}`)"), "href(`/users/${id}`)");
    });
  });

  describe("skips unrecognized calls", () => {
    it("spread arguments", () => {
      assert.equal(apply(`Run.href(...args)`), `Run.href(...args)`);
    });

    it("no arguments", () => {
      assert.equal(apply(`Run.href()`), `Run.href()`);
    });

    it("more than 2 arguments", () => {
      assert.equal(
        apply(`Run.href("/foo", {}, "extra")`),
        `Run.href("/foo", {}, "extra")`,
      );
    });

    it("other member expressions", () => {
      assert.equal(apply(`Other.href("/foo")`), `Other.href("/foo")`);
    });

    it("other method names on Run", () => {
      assert.equal(apply(`Run.path("/foo")`), `Run.path("/foo")`);
    });

    it("plain function calls", () => {
      assert.equal(apply(`href("/foo")`), `href("/foo")`);
    });

    it("computed member access", () => {
      assert.equal(apply(`Run["href"]("/foo")`), `Run["href"]("/foo")`);
    });
  });

  describe("multiple calls", () => {
    it("finds all calls in a module", () => {
      assert.equal(
        apply(
          [
            `const a = Run.href("/foo");`,
            `const b = Run.href("/bar/$id", { params: { id: "1" } });`,
          ].join("\n"),
        ),
        `const a = "/foo";\nconst b = "/bar/1";`,
      );
    });

    it("replaces mixed tiers correctly", () => {
      assert.equal(
        apply(`
        const a = Run.href("/static");
        const b = Run.href("/users/$id", { params: { id: val } });
        const c = Run.href("/posts/$pid", opts);
        const d = Run.href(dynamic);
      `),
        `
        const a = "/static";
        const b = href_path\`/users/\${val}\`;
        const c = href_keys\`\${opts}/posts/\${"pid"}\`;
        const d = href(dynamic);
      `,
      );
    });
  });
});
