import assert from "assert";
import { parseSync } from "oxc-parser";

import {
  collectShellManifest,
  findStaticShellIds,
  recordStaticShellIds,
} from "../utils/static-shells";

function parse(code: string) {
  const result = parseSync("module.js", code, {
    astType: "js",
    sourceType: "module",
  });
  return result.program;
}

describe("static-shells", () => {
  it("extracts the registered ids through the resolved import", () => {
    const ids = findStaticShellIds(
      parse(
        `import { _static_shells, _update_text } from "marko/dom-persisted";
        const $t = "<div></div>";
        _static_shells({ "a1": [$t, " D l"], "a": [$t, " D l"] });`,
      ),
    );
    assert.deepEqual(ids, ["a1", "a"]);
  });

  it("follows a renamed import", () => {
    const ids = findStaticShellIds(
      parse(
        `import { _static_shells as _s } from "marko/debug/dom-persisted";
        _s({ "x9": ["", ""] });`,
      ),
    );
    assert.deepEqual(ids, ["x9"]);
  });

  it("never claims from look-alike user code", () => {
    // No dom-persisted import: a user-defined _static_shells is not a
    // registration, and a template string mentioning the call is inert.
    assert.equal(
      findStaticShellIds(
        parse(
          `function _static_shells(x) { return x; }
          _static_shells({ "fake": [1] });
          const s = '_static_shells({ "also-fake": [' ;`,
        ),
      ),
      undefined,
    );
  });

  it("ignores non-registration modules", () => {
    assert.equal(findStaticShellIds(parse(`export const a = 1;`)), undefined);
  });
});

describe("static shell bookkeeping", () => {
  it("drops a module's claims once it stops registering", () => {
    const ids = new Map<string, string[]>();
    const id = "/app/route.persisted-entry.marko";
    recordStaticShellIds(ids, id, ["a1", "a"]);
    assert.deepEqual(ids.get(id), ["a1", "a"]);
    // A rebuild whose output no longer registers (the shell composes an
    // elided document frame, or the section stopped being constructible):
    // the stale entry would overclaim and force document fallback.
    recordStaticShellIds(ids, id, undefined);
    assert.equal(ids.has(id), false);
    recordStaticShellIds(ids, id, ["b1"]);
    recordStaticShellIds(ids, id, []);
    assert.equal(ids.has(id), false);
  });
});

describe("shell manifest walk", () => {
  const chunk = (
    fileName: string,
    moduleIds: string[],
    imports: string[] = [],
    facadeModuleId?: string,
  ) => ({
    type: "chunk" as const,
    fileName,
    facadeModuleId,
    modules: Object.fromEntries(moduleIds.map((id) => [id, {}])),
    imports,
  });

  const ids = new Map([
    ["/app/route-a.persisted-entry.marko", ["a1", "a2"]],
    ["/app/card.persisted-entry.marko", ["j5"]],
    ["/app/route-b.persisted-entry.marko", ["b1"]],
    ["/app/lazy.persisted-entry.marko", ["z9"]],
  ]);

  const bundle = {
    "a.js": chunk(
      "a.js",
      ["/app/route-a.persisted-entry.marko"],
      ["shared.js"],
      "/app/route-a.persisted-entry.marko",
    ),
    // Shared chunk: cohabitants evaluate with the entry, so their shells
    // are provable possessions of every route that imports the chunk.
    "shared.js": chunk("shared.js", [
      "/app/card.persisted-entry.marko",
      "/app/unrelated.js",
    ]),
    // Facade-less entry: found through chunk.modules.
    "b.js": chunk("b.js", ["/app/route-b.persisted-entry.marko", "/app/x.js"]),
    // Reached only via dynamic import: never part of any floor.
    "lazy.js": chunk("lazy.js", ["/app/lazy.persisted-entry.marko"]),
    "style.css": { type: "asset" as const },
  };

  it("unions the static closure and excludes dynamic imports", () => {
    const manifest = collectShellManifest(
      [
        { index: 0, entryModuleId: "/app/route-a.persisted-entry.marko" },
        { index: 1, entryModuleId: "/app/route-b.persisted-entry.marko" },
      ],
      bundle,
      ids,
    );
    assert.deepEqual(manifest, {
      "0": ["a1", "a2", "j5"],
      "1": ["b1"],
    });
  });

  it("claims nothing for a route whose entry chunk is missing", () => {
    const manifest = collectShellManifest(
      [{ index: 3, entryModuleId: "/app/gone.persisted-entry.marko" }],
      bundle,
      ids,
    );
    assert.deepEqual(manifest, {});
  });

  it("survives an import cycle between chunks", () => {
    const cyclic = {
      "a.js": chunk(
        "a.js",
        ["/app/route-a.persisted-entry.marko"],
        ["b.js"],
        "/app/route-a.persisted-entry.marko",
      ),
      "b.js": chunk("b.js", ["/app/card.persisted-entry.marko"], ["a.js"]),
    };
    const manifest = collectShellManifest(
      [{ index: 0, entryModuleId: "/app/route-a.persisted-entry.marko" }],
      cyclic,
      ids,
    );
    assert.deepEqual(manifest, { "0": ["a1", "a2", "j5"] });
  });
});
