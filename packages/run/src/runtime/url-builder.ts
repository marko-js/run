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

function joinHref(path: string, options: HrefOptions<any>) {
  let result = path;
  if (options.search) {
    const query = "" + new URLSearchParams(options.search);
    if (query) result += "?" + query;
  }
  if (options.hash || options.hash === 0) result += "#" + encode(options.hash);
  return result;
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
    result +=
      (Array.isArray(param) ? param.map(encode).join("/") : encode(param)) +
      strings[i++];
  }
  return result;
}

export function href_values(
  strings: TemplateStringsArray,
  options: HrefOptions<any>,
  ...params: (string | number | (string | number)[])[]
) {
  return joinHref(href_path(strings, ...params), options);
}

export function href_keys(
  strings: TemplateStringsArray,
  options: HrefOptions,
  ...keys: string[]
) {
  return href_values(strings, options, ...keys.map((k) => options.params[k]));
}
