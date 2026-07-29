import type { Program } from "@oxc-project/types";

interface BundleChunk {
  type: string;
  fileName: string;
  facadeModuleId?: string | null;
  modules: Record<string, unknown>;
  imports: string[];
}

/**
 * Unions each route's held shells over its persisted entry chunk's static
 * closure: every module in those chunks evaluates together when the entry
 * loads, so their registrations are provable possessions; dynamic imports
 * are excluded (not provably loaded). A route whose entry chunk cannot be
 * found claims nothing — an underclaim only ships shells it did not need
 * to.
 */
export function collectShellManifest(
  routes: { index: number; entryModuleId: string }[],
  bundle: Record<string, BundleChunk | { type: string }>,
  staticShellIds: ReadonlyMap<string, string[]>,
): Record<string, string[]> {
  const manifest: Record<string, string[]> = {};
  const chunks = Object.values(bundle).filter(
    (item): item is BundleChunk => item.type === "chunk",
  );
  for (const route of routes) {
    let entryChunk;
    for (const chunk of chunks) {
      if (
        chunk.facadeModuleId === route.entryModuleId ||
        route.entryModuleId in chunk.modules
      ) {
        entryChunk = chunk;
        break;
      }
    }
    if (!entryChunk) continue;
    const held = new Set<string>();
    const seen = new Set<string>();
    const walk = (fileName: string) => {
      if (seen.has(fileName)) return;
      seen.add(fileName);
      const chunk = bundle[fileName];
      if (chunk?.type !== "chunk") return;
      for (const moduleId in (chunk as BundleChunk).modules) {
        const ids = staticShellIds.get(moduleId);
        if (ids) for (const id of ids) held.add(id);
      }
      for (const imported of (chunk as BundleChunk).imports) walk(imported);
    };
    walk(entryChunk.fileName);
    if (held.size) manifest[route.index] = [...held];
  }
  return manifest;
}

/**
 * Records what a persisted module registers now. The map outlives a single
 * build, so a module that stops registering (a watch-mode edit, or a
 * recompile that elides its shells) must drop its previous entry: a stale
 * claim overclaims the client's possessions and forces document fallback.
 */
export function recordStaticShellIds(
  staticShellIds: Map<string, string[]>,
  id: string,
  ids: string[] | undefined,
) {
  if (ids?.length) {
    staticShellIds.set(id, ids);
  } else {
    staticShellIds.delete(id);
  }
}

/**
 * Extracts the shell ids a compiled `?persisted` module registers with the
 * client applier: the string keys of its top-level
 * `_static_shells({ "<id>": [...], ... })` call, with the callee resolved
 * through the module's own `marko/dom-persisted` import so neither renaming
 * nor look-alike user code can mint a claim.
 */
export function findStaticShellIds(program: Program): string[] | undefined {
  let localName: string | undefined;
  for (const node of program.body) {
    if (
      node.type === "ImportDeclaration" &&
      typeof node.source.value === "string" &&
      /\/dom-persisted$/.test(node.source.value)
    ) {
      for (const spec of node.specifiers) {
        if (
          spec.type === "ImportSpecifier" &&
          spec.imported.type === "Identifier" &&
          spec.imported.name === "_static_shells"
        ) {
          localName = spec.local.name;
        }
      }
    }
  }
  if (!localName) return;

  for (const node of program.body) {
    if (
      node.type === "ExpressionStatement" &&
      node.expression.type === "CallExpression" &&
      node.expression.callee.type === "Identifier" &&
      node.expression.callee.name === localName &&
      node.expression.arguments[0]?.type === "ObjectExpression"
    ) {
      const ids: string[] = [];
      for (const prop of node.expression.arguments[0].properties) {
        if (
          prop.type === "Property" &&
          prop.key.type === "Literal" &&
          typeof prop.key.value === "string"
        ) {
          ids.push(prop.key.value);
        }
      }
      return ids;
    }
  }
}
