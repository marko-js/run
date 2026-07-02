import type {
  Expression,
  Node,
  ObjectExpression,
  ObjectProperty,
  Program,
} from "@oxc-project/types";

import { href, parsePathParts } from "../../runtime/url-builder";

interface HrefEdit {
  /** Start offset in the source (from the AST node). */
  start: number;
  /** End offset in the source (from the AST node). */
  end: number;
  /** The replacement source code to insert. */
  code: string;
}

export interface HrefReplacement {
  /** Which runtime helper is needed (false = no import needed). */
  helper: false | "href" | "href_path" | "href_values" | "href_keys";
  /** Source edits to apply for this call site. */
  edits: HrefEdit[];
}

interface ParsedPath {
  /** Static segments alternating with param slots: [static, static, ...]. */
  segments: string[];
  /** Param info in path order. */
  params: string[];
}

/**
 * Walk an ESTree AST and find `Run.href(pathString, options?)` call
 * expressions that can be optimized.
 *
 * Returns an array of surgical replacements (multiple per call site)
 * that can be applied via magic string.
 *
 * Optimization tiers:
 *
 * - **Tier 0 (fully static):** Both path and options are compile-time constants.
 *   Single replacement of the entire call with a string literal.
 *
 * - **Tier 1a (href_path):** Static path, visible params, no other options.
 *   Single replacement of the entire call with a tagged template.
 *
 * - **Tier 1b (href_values):** Static path, visible params, plus other options.
 *   Three replacements: callee → tagged template, delete first arg, delete
 *   params property — preserving the original options object.
 *
 * - **Tier 2 (href_keys):** Static path, opaque options.
 *   Two replacements: callee → tagged template, delete first arg.
 *
 * - **Fallback (href):** Dynamic path or unserializable AST.
 *   Single replacement of the callee only.
 *
 * @param ast   The ESTree AST to walk.
 */
export function findHrefReplacements(
  code: string,
  ast: Program,
): HrefReplacement[] {
  const replacements: HrefReplacement[] = [];

  // If the module declares its own `Run` binding anywhere, a matched
  // `Run.href(...)` may refer to that binding rather than the global
  // namespace, so leave the module untouched.
  if (hasRunBinding(ast)) {
    return replacements;
  }

  walk(ast, (node: Node) => {
    if (node.type !== "CallExpression") return;

    const callee = node.callee;
    if (
      callee.type !== "MemberExpression" ||
      callee.computed ||
      callee.object.type !== "Identifier" ||
      callee.object.name !== "Run" ||
      callee.property.type !== "Identifier" ||
      callee.property.name !== "href"
    ) {
      return;
    }

    const args = node.arguments;
    if (
      args.length === 0 ||
      args.length > 2 ||
      args.some((a) => a.type === "SpreadElement")
    ) {
      return;
    }

    // First arg: path string
    const pathString = tryStaticEval(args[0] as Expression)?.value;

    if (typeof pathString !== "string") {
      // Dynamic path — just replace callee with runtime href
      replacements.push({
        helper: "href",
        edits: [{ start: callee.start, end: callee.end, code: "href" }],
      });
      return;
    }

    // const pathString: string = pathResult.value;

    // No options — tier 0 (just the path string)
    if (args.length === 1) {
      replacements.push({
        helper: false,
        edits: [
          {
            start: node.start,
            end: node.end,
            code: JSON.stringify(pathString),
          },
        ],
      });
      return;
    }

    const optionsNode = args[1];
    const optionsObject = tryStaticEval(optionsNode)?.value;

    if (
      optionsObject &&
      typeof optionsObject === "object" &&
      !Array.isArray(optionsObject)
    ) {
      replacements.push({
        helper: false,
        edits: [
          {
            start: node.start,
            end: node.end,
            code: JSON.stringify(href(pathString, optionsObject)),
          },
        ],
      });
      return;
    }

    const parsed = parsePathPattern(pathString);

    // Try tier 1: object literal with extractable params
    if (optionsNode.type === "ObjectExpression") {
      const params = tryExtractObjectProperty(optionsNode, "params");
      if (params && parsed.params.every((p) => params.map.has(p))) {
        const pathPart = buildPathTemplate(code, parsed, params.map);

        if (params.only) {
          // Tier 1a: href_path — replace entire call
          replacements.push({
            helper: "href_path",
            edits: [
              {
                start: node.start,
                end: node.end,
                code: "href_path`" + pathPart + "`",
              },
            ],
          });
        } else {
          // Tier 1b: href_values — wrap options in tagged template,
          // delete params property
          const props = optionsNode.properties;
          const remaining = props.filter((_, i) => i !== params.index);

          // If after removing params only a single spread remains,
          // unwrap it: { ...x } → x
          if (remaining.length === 1 && remaining[0].type === "SpreadElement") {
            replacements.push({
              helper: "href_values",
              edits: [
                {
                  start: node.start,
                  end: remaining[0].argument.start,
                  code: "href_values`${",
                },
                {
                  start: remaining[0].argument.end,
                  end: node.end,
                  code: "}" + pathPart + "`",
                },
              ],
            });
          } else {
            replacements.push({
              helper: "href_values",
              edits: [
                {
                  start: node.start,
                  end: optionsNode.start,
                  code: "href_values`${",
                },
                {
                  start: optionsNode.end,
                  end: node.end,
                  code: "}" + pathPart + "`",
                },
                params.index < props.length - 1
                  ? {
                      start: props[params.index].start,
                      end: props[params.index + 1].start,
                      code: "",
                    }
                  : {
                      start: props[params.index - 1].end,
                      end: props[params.index].end,
                      code: "",
                    },
              ],
            });
          }
        }
        return;
      }
    }

    // Tier 2: static path, opaque options — wrap options in tagged template
    replacements.push({
      helper: "href_keys",
      edits: [
        { start: node.start, end: optionsNode.start, code: "href_keys`${" },
        {
          start: optionsNode.end,
          end: node.end,
          code: `}${buildPathTemplate(code, parsed)}\``,
        },
      ],
    });
  });

  return replacements;
}

/**
 * Detect whether any declaration in the module binds the name `Run` —
 * imports, variable/function/class declarations, function params, or
 * catch clause params.
 */
function hasRunBinding(ast: Program): boolean {
  let found = false;

  const checkPattern = (pattern: Node | null | undefined) => {
    if (!pattern || found) return;
    switch (pattern.type) {
      case "Identifier":
        if (pattern.name === "Run") found = true;
        break;
      case "ObjectPattern":
        for (const prop of pattern.properties) {
          checkPattern(
            prop.type === "RestElement" ? prop.argument : prop.value,
          );
        }
        break;
      case "ArrayPattern":
        for (const element of pattern.elements) checkPattern(element);
        break;
      case "AssignmentPattern":
        checkPattern(pattern.left);
        break;
      case "RestElement":
        checkPattern(pattern.argument);
        break;
    }
  };

  walk(ast, (node: Node) => {
    if (found) return;
    switch (node.type) {
      case "VariableDeclarator":
        checkPattern(node.id);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if ("id" in node) checkPattern(node.id);
        for (const param of node.params) checkPattern(param);
        break;
      case "ClassDeclaration":
      case "ClassExpression":
        checkPattern(node.id);
        break;
      case "CatchClause":
        checkPattern(node.param);
        break;
      case "ImportDefaultSpecifier":
      case "ImportSpecifier":
      case "ImportNamespaceSpecifier":
        checkPattern(node.local);
        break;
    }
  });

  return found;
}

function walk(node: Node, visitor: (node: Node) => void) {
  if (!node || typeof node !== "object") return;
  if (node.type) {
    visitor(node);
  }

  for (const key of Object.keys(node)) {
    if (
      key === "type" ||
      key === "start" ||
      key === "end" ||
      key === "loc" ||
      key === "range"
    ) {
      continue;
    }

    const child = (node as any)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) {
          walk(item, visitor);
        }
      }
    } else if (child && typeof child === "object" && child.type) {
      walk(child, visitor);
    }
  }
}
/**
 * Parse a route path pattern into its static segments and param descriptors.
 * Mirrors the parsing logic in url-builder.ts.
 *
 * Example: "/users/$id/posts/$$rest"
 * → segments: ["/users/", "/posts/"], params: [{name:"id",rest:false},{name:"rest",rest:true}]
 */
function parsePathPattern(path: string): ParsedPath {
  const parts = parsePathParts(path);
  return { segments: parts.slice(1) as string[], params: parts[0] };
}

/**
 * Build the path portion of a tagged template (without tag or backticks).
 * When paramsMap is provided, interpolates param values from source code.
 * When omitted (href_keys), interpolates param names as string literals.
 */
function buildPathTemplate(
  code: string,
  parsed: ParsedPath,
  paramsMap?: Map<string, ObjectProperty>,
): string {
  let template = "";
  for (let i = 0; i < parsed.params.length; i++) {
    template += escapeTemplateChunk(parsed.segments[i]);
    if (paramsMap) {
      const paramProp = paramsMap.get(parsed.params[i])!;
      const valueNode = paramProp.shorthand ? paramProp.key : paramProp.value;
      template += "${" + code.slice(valueNode.start, valueNode.end) + "}";
    } else {
      template += '${"' + parsed.params[i] + '"}';
    }
  }
  if (parsed.segments.length > parsed.params.length) {
    template += escapeTemplateChunk(
      parsed.segments[parsed.segments.length - 1],
    );
  }
  return template;
}

/**
 * Escape a static path chunk so it can be embedded in a template literal.
 */
function escapeTemplateChunk(value: string): string {
  return value.replace(/[`\\]/g, "\\$&").replace(/\$\{/g, "\\${");
}

function getStaticKey(prop: ObjectProperty): string | null {
  if (prop.computed) return null;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string")
    return prop.key.value;
  return null;
}

/**
 * Try to statically evaluate an ESTree AST node to a JavaScript value.
 * Returns the value wrapped in an object, or `null` if the node cannot be
 * statically determined at build time.
 */
function tryStaticEval(node: Node): { value: unknown } | null {
  switch (node.type) {
    case "Literal":
      return { value: node.value };

    case "TemplateLiteral":
      return node.expressions.length
        ? null
        : { value: node.quasis[0].value.cooked };

    case "ObjectExpression": {
      const value: Record<string, unknown> = {};
      for (const prop of node.properties) {
        if (prop.type === "SpreadElement" || prop.shorthand) return null;
        const key = getStaticKey(prop);
        if (!key) return null;
        const val = tryStaticEval(prop.value);
        if (!val) return null;
        value[key] = val.value;
      }
      return { value };
    }

    case "ArrayExpression": {
      const value: unknown[] = [];
      for (const elem of node.elements) {
        if (!elem || elem.type === "SpreadElement") return null;
        const val = tryStaticEval(elem);
        if (!val) return null;
        value.push(val.value);
      }
      return { value };
    }

    case "UnaryExpression":
      if (node.prefix && node.operator === "-") {
        const arg = tryStaticEval(node.argument);
        if (arg && typeof arg.value === "number") {
          return { value: -arg.value };
        }
      }
      return null;

    default:
      return null;
  }
}

/**
 * Try to extract static keys from a named property of an ObjectExpression.
 * Returns a map of key → AST property node if all keys are static identifiers/string literals.
 * Returns null if the object doesn't have the named property or it's not analyzable.
 */
function tryExtractObjectProperty(obj: ObjectExpression, propertyName: string) {
  const props = obj.properties;

  // Walk backwards: a spread before finding the property means it could be overridden.
  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i];
    if (prop.type === "SpreadElement") return null;
    if (getStaticKey(prop) !== propertyName) continue;

    // Found it — value must be an object literal with static keys
    if (prop.value.type !== "ObjectExpression") return null;

    const map = new Map<string, ObjectProperty>();
    for (const paramProp of prop.value.properties) {
      if (paramProp.type === "SpreadElement") return null;
      const paramKey = getStaticKey(paramProp);
      if (!paramKey) return null;
      map.set(paramKey, paramProp);
    }

    let only = i === props.length - 1;
    let j = i;
    while (only && j--) {
      const prop = props[j];
      only = prop.type === "Property" && getStaticKey(prop) === propertyName;
    }
    return { map, index: i, only };
  }

  return null;
}
