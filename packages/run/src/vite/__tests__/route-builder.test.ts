import assert from "assert";

import { buildRoutes } from "../routes/builder";
import { createTestWalker } from "../routes/walk";
import type { PathInfo } from "../types";
import { createDirectory } from "./utils/fakeFS";

type PathParams = Pick<PathInfo, "path" | "params">;

function buildTestRoutes(content: string) {
  return buildRoutes(
    {
      walker: createTestWalker(createDirectory(content), "src/routes"),
    },
    "/dist/.marko-run",
  );
}

describe("route-builder", () => {
  async function fixture(dir: string, ...expected: PathParams[]) {
    const routes = await buildTestRoutes(dir);
    const actual = routes.list.map<PathParams>((route) =>
      route.path.params
        ? {
            path: route.path.path,
            params: route.path.params,
          }
        : {
            path: route.path.path,
          },
    );
    assert.deepEqual(actual, expected);
  }

  it("should work for a basic static case", async () => {
    await fixture(
      `
        /a
          /b
            +page.marko
        `,
      { path: "/a/b" },
    );
  });

  it("should work for a basic dynamic case", async () => {
    await fixture(
      `
        /a
          /$id
            +page.marko
        `,
      { path: "/a/$id", params: { id: 1 } },
    );
  });

  it("should work for a catch-all dynamic case", async () => {
    await fixture(
      `
        /a
          /$$rest
            +page.marko
        `,
      { path: "/a/$$rest", params: { rest: null } },
    );
  });

  it("should work for a catch-all dynamic case after a param", async () => {
    await fixture(
      `
        /$id
          /$$rest
            +page.marko
        `,
      { path: "/$id/$$rest", params: { id: 0, rest: null } },
    );
  });

  it("should exclude unnamed params from the param list", async () => {
    await fixture(
      `
        /a
          /$
            /$$
              +page.marko
        `,
      { path: "/a/$/$$" },
    );
  });

  it("should work for a basic pathless case", async () => {
    await fixture(
      `
        /a
          /_
            /$id
              +page.marko
        `,
      { path: "/a/$id", params: { id: 1 } },
    );
  });

  it("should work for multi-dimensional case", async () => {
    await fixture(
      `
        /a,b
          /c,d
            /$id
              +page.marko
        `,
      { path: "/a/c/$id", params: { id: 2 } },
      { path: "/a/d/$id", params: { id: 2 } },
      { path: "/b/c/$id", params: { id: 2 } },
      { path: "/b/d/$id", params: { id: 2 } },
    );
  });

  it("should work for optional segements", async () => {
    await fixture(
      `
        /a,b
          /c,_
            /$id
              +page.marko
      `,
      { path: "/a/$id", params: { id: 1 } },
      { path: "/a/c/$id", params: { id: 2 } },
      { path: "/b/$id", params: { id: 1 } },
      { path: "/b/c/$id", params: { id: 2 } },
    );
  });

  it("should work for optional dynamic segements", async () => {
    await fixture(
      `
        /$foo,
          /$bar
            +page.marko
      `,
      { path: "/$foo/$bar", params: { foo: 0, bar: 1 } },
      { path: "/$bar", params: { bar: 0 } },
    );
  });
  it("should throw on ambiguous hoisting", async () => {
    await assert.rejects(
      () =>
        buildTestRoutes(`
        /a,
          /a,
            +page.marko
      `),
      (err: Error) => {
        return err.message.startsWith("Ambiguous directory structure");
      },
    );
  });

  it("should throw on duplication at one level", async () => {
    await assert.rejects(
      () =>
        buildTestRoutes(`
        /a,a,b
          +page.marko
      `),
      (err: Error) => {
        return err.message.startsWith("Invalid route pattern");
      },
    );
  });

  it("should throw ambiguous optional parameters", async () => {
    await assert.rejects(
      () =>
        buildTestRoutes(`
        /$a,_
          /$b,_
            /$c,_
              +page.marko
      `),
      (err: Error) => {
        return err.message.startsWith("Duplicate routes for path");
      },
    );
  });

  it("should throw on duplicate paths", async () => {
    await assert.rejects(
      () =>
        buildTestRoutes(`
        /foo
          /bar
            +page.marko
        /_
          /foo
            /bar
              +page.marko
      `),
      (err: Error) => err.message.startsWith("Duplicate routes for path"),
    );
  });

  it("should find 404 and 500 pages in the root", async () => {
    const routes = await buildTestRoutes(`
      +404.marko
      +500.marko
    `);
    assert.deepEqual(Object.keys(routes.special), ["404", "500"]);
  });

  it("should ignore nested 404 and 500 pages", async () => {
    const routes = await buildTestRoutes(`
        /foo
          +404.marko
          +500.marko
      `);

    assert.deepEqual(Object.keys(routes.special), []);
  });

  it("should work with flat route files", async () => {
    const routes = await buildTestRoutes(`
      +layout.marko
      a.b.(c,)+page.marko
      a.b.c+middleware.marko
      a.b+handler.marko
    `);
    const actual = routes.list.map((route) => ({
      path: route.path.path,
      page: !!route.page,
      handler: !!route.handler,
      middleware: route.middleware.length,
      layouts: route.layouts.length,
    }));

    assert.deepEqual(actual, [
      {
        path: "/a/b",
        page: true,
        handler: true,
        middleware: 0,
        layouts: 1,
      },
      {
        path: "/a/b/c",
        page: true,
        handler: false,
        middleware: 1,
        layouts: 1,
      },
    ]);
  });
});
