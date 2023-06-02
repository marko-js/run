import { buildRoutes, evaluatePaths } from "../routes/builder";
import { createTestWalker } from "../routes/walk";
import { createDirectory } from "./utils/fakeFS";
import assert from "assert";
import type { PathInfo, Route } from "../types";

type PathParams = Pick<PathInfo, "path" | "params">;

function createWalker(dir: string) {
  return createTestWalker(createDirectory(dir));
}

describe("route-builder", () => {
  describe("evaluatePaths", () => {
    function fixture(dirs: string[], expected: string[]) {
      let paths: PathInfo[] = [{ id: "", path: "/", segments: [] }];
      for (const dir of dirs) {
        paths = evaluatePaths(dir, paths);
      }
      const actual = paths.map((path) => path.path);
      assert.deepEqual(actual, expected);
    }

    it("should traverse paths breadth-first, pathless then left to right", () => {
      fixture(
        ["a,$foo,_", "_,$bar", "$baz,_"],
        [
          "/",
          "/a",
          "/$foo",
          "/a/$bar",
          "/$foo/$bar",
          "/a/$bar/$baz",
          "/$foo/$bar/$baz",
        ]
      );
    });
  });

  describe("buildRoutes", () => {
    async function fixture(
      dir: string,
      ...expected: PathParams[]
    ) {
      const routes = await buildRoutes(createWalker(dir));
      const actual = routes.list.reduce<PathParams[]>((acc, route) => {
        acc.push(...route.paths.map((path) => ({ path: path.path, params: path.params })));
        return acc;
      }, []);
      assert.deepEqual(actual, expected);
    }

    it("should work for a basic static case", async () => {
      await fixture(
        `
        /a
          /b
            +page.marko
        `,
        { path: "/a/b", params: undefined }
      );
    });

    it("should work for a basic dynamic case", async () => {
      await fixture(
        `
        /a
          /$id
            +page.marko
        `,
        { path: "/a/$id", params: { id: 1 } }
      );
    });

    it("should work for a catch-all dynamic case", async () => {
      await fixture(
        `
        /a
          /$$rest
            +page.marko
        `,
        { path: "/a/$$rest", params: { rest: null } }
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
        { path: "/a/$/$$", params: undefined }
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
        { path: "/a/$id", params: { id: 1 } }
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
        { path: "/b/d/$id", params: { id: 2 } }
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
        { path: "/b/$id", params: { id: 1 } },
        { path: "/a/c/$id", params: { id: 2 } },
        { path: "/b/c/$id", params: { id: 2 } },
      );
    });

    it("should dedupe at each level", async () => {
      await fixture(
        `
        /a,a,b
          /c,c,d
            /$id,$name
              +page.marko
      `,
        { path: "/a/c/$id", params: { id: 2 } },
        { path: "/a/d/$id", params: { id: 2 } },
        { path: "/b/c/$id", params: { id: 2 } },
        { path: "/b/d/$id", params: { id: 2 } }
      );
    });

    it("should prefer named dynamic segments", async () => {
      await fixture(
        `
        /$,$id
          +page.marko
      `,
        { path: "/$id", params: { id: 0 } }
      );
    });

    it("should dedupe duplicate dynamic combinations", async () => {
      await fixture(
        `
        /_,a,$foo
          /_,b,$bar
            /_,$id,c
              +page.marko
        `,

        { path: "/", params: undefined },
        { path: "/a", params: undefined },
        {
          path: "/$foo",
          params: {
            foo: 0,
          },
        },
        { path: "/b", params: undefined },
        { path: "/a/b", params: undefined },
        {
          path: "/a/$bar",
          params: {
            bar: 1,
          },
        },
        {
          path: "/$foo/b",
          params: {
            foo: 0,
          },
        },
        {
          path: "/$foo/$bar",
          params: {
            foo: 0,
            bar: 1,
          },
        },
        { path: "/c", params: undefined },
        { path: "/a/c", params: undefined },
        {
          path: "/$foo/c",
          params: {
            foo: 0,
          },
        },
        { path: "/b/$id", params: { id: 1 } },
        { path: "/b/c", params: undefined },
        { path: "/a/b/$id", params: { id: 2 } },
        { path: "/a/b/c", params: undefined },
        {
          path: "/a/$bar/$id",
          params: {
            bar: 1,
            id: 2,
          },
        },
        {
          path: "/a/$bar/c",
          params: {
            bar: 1,
          },
        },
        {
          path: "/$foo/b/$id",
          params: {
            foo: 0,
            id: 2,
          },
        },
        {
          path: "/$foo/b/c",
          params: {
            foo: 0,
          },
        },
        {
          path: "/$foo/$bar/$id",
          params: {
            foo: 0,
            bar: 1,
            id: 2,
          },
        },
        {
          path: "/$foo/$bar/c",
          params: {
            foo: 0,
            bar: 1,
          },
        },
      );
    });

    it("should throw on duplicate paths", async () => {
      const walker = createWalker(`
        /foo
          /bar
            +page.marko
        /_
          /foo
            /bar
              +page.marko
      `);

      assert.rejects(
        () => buildRoutes(walker),
        /Duplicate routes for path \/foo\/bar/
      );
    });
  });
});
