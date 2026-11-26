import type { HrefOptions, PathsForVerb } from "./types";

const encode = encodeURIComponent;
const pathParts = new Map<string, [string[], ...string[]]>();

export function parsePathParts(path: string) {
  let parts = pathParts.get(path);
  if (!parts) {
    let lastEnd = 0;
    let paramStart;

    pathParts.set(path, (parts = [[]]));
    while (lastEnd >= 0 && (paramStart = path.indexOf("/$", lastEnd) + 1)) {
      parts.push(path.slice(lastEnd, paramStart++));
      if (path.charAt(paramStart) === "$") {
        paramStart++;
        lastEnd = -1;
      } else {
        lastEnd = path.indexOf("/", paramStart);
      }
      const param = path.slice(paramStart, lastEnd < 0 ? undefined : lastEnd);
      parts[0].push(
        param.length > 1 &&
          param.charAt(0) === "`" &&
          param.charAt(param.length - 1) === "`"
          ? param.slice(1, -1)
          : param,
      );
    }
    parts.push(lastEnd >= 0 ? path.slice(lastEnd) : "");
  }
  return parts;
}

export function href<Path extends PathsForVerb>(
  path: Path,
  ...[options]: Path extends `${string}/$${string}`
    ? [options: HrefOptions<Path>]
    : [options?: HrefOptions<Path>]
): string {
  return options
    ? "params" in options
      ? ((parts) => href_keys(parts as any, options, ...parts[0]))(
          parsePathParts(path),
        )
      : joinHref(path, options)
    : path;
}

export function href_path(
  strings: TemplateStringsArray,
  ...params: (string | number | (string | number)[])[]
) {
  let i = 0;
  let j = 0;
  let result = strings[i++];
  if (!result || Array.isArray(result)) result = strings[i++];
  while (i < strings.length) {
    const param = params[j++];
    const next = strings[i++];
    // An empty param that ends the path links to the parent route.
    result +=
      (next || "" + param
        ? Array.isArray(param)
          ? param.map(encodeParam).join("/") || encodeParam("")
          : encodeParam(param)
        : "") + next;
  }
  return result;
}

export function href_values(
  strings: TemplateStringsArray,
  options: HrefOptions<any> | null | undefined,
  ...params: (string | number | (string | number)[])[]
) {
  return joinHref(href_path(strings, ...params), options || {});
}

export function href_keys(
  strings: TemplateStringsArray,
  options: HrefOptions | null | undefined,
  ...keys: string[]
) {
  return href_values(strings, options, ...keys.map((k) => options!.params[k]));
}

// Rejects a missing param, and values that would turn the segment into `//`,
// `.` or `..`.
function encodeParam(param: string | number) {
  if (param == null || param === "" || param === "." || param === "..") {
    throw new TypeError(`Invalid param "${param}"`);
  }
  return encode(param);
}

function joinHref(path: string, { search, hash }: HrefOptions<any>) {
  let sep = "?";
  // `for...in` is intentional: including enumerable inherited keys is fine.
  for (const key in search) {
    const value = search[key as keyof typeof search];
    // An array repeats the key, as the search parser reads it back.
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== void 0) {
        path += `${sep}${encode(key)}=${encode(item)}`;
        sep = "&";
      }
    }
  }
  return hash || hash === 0 ? `${path}#${encode(hash)}` : path;
}
