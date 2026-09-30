import assert from "assert";

import { renderPatchStyles } from "../codegen";
import type { RoutableFile, Route } from "../types";

describe("patch styles", () => {
  const file = (name: string) =>
    ({
      id: name,
      name,
      type: "page",
      filePath: `/app/${name}`,
    }) as RoutableFile;
  const route = (page: RoutableFile, ...layouts: RoutableFile[]) =>
    ({ key: page.name, page, layouts }) as unknown as Route;
  const chunk = (
    moduleIds: string[],
    importedCss: string[],
    imports: string[] = [],
    dynamicImports: string[] = [],
  ) => ({
    type: "chunk",
    moduleIds,
    imports,
    dynamicImports,
    viteMetadata: { importedCss: new Set(importedCss) },
  });

  it("lists each page's stylesheets as its document links them", () => {
    const root = file("root.marko");
    const docs = file("docs.marko");
    const home = file("home.marko");
    const guide = file("guide.marko");
    const missing = file("404.marko");
    const pages = new Map([
      [route(home, root), 0],
      [route(guide, root, docs), 1],
      [route(missing, root), 2],
    ]);
    const bundle = {
      "app.js": chunk(
        ["/app/app.marko", "/app/root.marko"],
        ["app.css"],
        ["shared.js"],
        ["home.js", "docs.js", "guide.js", "404.js", "search.js"],
      ),
      // A root layout's lazy tag: on every page, whichever it is.
      "search.js": chunk(["/app/search.marko"], ["search.css"], ["shared.js"]),
      "shared.js": chunk(["/app/button.marko"], ["button.css"]),
      "home.js": chunk(
        ["/app/home.marko"],
        ["home.css"],
        ["shared.js", "text.js"],
        ["widget.js"],
      ),
      "text.js": chunk(["/app/text.marko"], ["text.css"]),
      "widget.js": chunk(["/app/widget.marko"], ["widget.css"], ["app.js"]),
      "docs.js": chunk(["/app/docs.marko"], ["docs.css"], ["text.js"]),
      // Another page's module is its own to link, though this one reaches it.
      "guide.js": chunk(["/app/guide.marko"], ["guide.css"], [], ["home.js"]),
      "404.js": chunk(["/app/404.marko"], []),
    } as any;

    const code = renderPatchStyles(
      bundle,
      { filePath: "/app/app.marko", pages, id: "b1" },
      "/assets/",
    );
    const [hrefs, list] = new Function(
      `${code}; return __MARKO_RUN_STYLES__()`,
    )();
    assert.deepEqual(
      list.map((indexes: number[]) => indexes.map((i) => hrefs[i])),
      [
        ["/assets/home.css", "/assets/text.css", "/assets/widget.css"],
        ["/assets/docs.css", "/assets/text.css", "/assets/guide.css"],
        [],
      ],
    );
  });

  it("names no stylesheets without the app template's chunk", () => {
    const code = renderPatchStyles(
      {},
      { filePath: "/app/app.marko", pages: new Map(), id: "b1" },
      "/",
    );
    assert.equal(
      new Function(`${code}; return __MARKO_RUN_STYLES__()`)(),
      undefined,
    );
  });
});
