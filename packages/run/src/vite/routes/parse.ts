export interface Segment {
  raw: string;
  name: string;
  type?: "_" | "$" | "$$" | undefined;
  param?: string;
}

export interface Path {
  id: string;
  segments: Segment[];
  isCatchall?: boolean;
  source: string;
}

const enum CharCodes {
  Dynamic = 36, // $
  GroupStart = 40, // (
  GroupEnd = 41, // )
  Alternate = 44, // ,
  Directory = 46, // .
  Pathless = 95, // _
  Escape = 96, // `
}

export function parseFlatRoute(pattern: string): Path[] {
  if (!pattern) throw new Error("Empty pattern");

  const len = pattern.length;
  let i = 0;

  return parse([
    {
      id: "/",
      segments: [],
      source: pattern,
    },
  ]);

  function parse(basePaths: Path[], group?: number): Path[] {
    const pathMap = new Map<string, Path>();
    const delimiters = group ? "`).," : "`.,";
    let charCode: number;
    let segmentStart = i;
    let type: "_" | "$" | "$$" | undefined;
    let current: Path[] | undefined;
    let escaped = "";
    let escapeStart = 0;

    do {
      charCode = pattern.charCodeAt(i);
      if (charCode === CharCodes.Escape) {
        if (escapeStart) {
          escaped +=
            pattern.slice(segmentStart, escapeStart - 1) +
            pattern.slice(escapeStart, i);
          escapeStart = 0;
          segmentStart = ++i;
        } else {
          escapeStart = i + 1;
          i = pattern.indexOf("`", escapeStart);
          if (i < 0) break;
        }
      } else if (charCode === CharCodes.GroupEnd && group) {
        break;
      } else if (charCode === CharCodes.Alternate) {
        if (!current) {
          segmentEnd(
            basePaths.map((path) => ({
              ...path,
              segments: path.segments.slice(),
            })),
            escaped,
            "_",
            pathMap,
          );
        } else {
          segmentEnd(
            current,
            escaped + pattern.slice(segmentStart, i),
            type,
            pathMap,
          );
        }
        current = undefined;
        type = undefined;
        escaped = "";
        segmentStart = ++i;
      } else if (charCode === CharCodes.Directory) {
        if (current) {
          segmentEnd(current, escaped + pattern.slice(segmentStart, i), type);
        }
        type = undefined;
        escaped = "";
        segmentStart = ++i;
      } else if (charCode === CharCodes.GroupStart) {
        const groupPaths = parse(current || basePaths, ++i);
        if (groupPaths.length) {
          current = groupPaths;
        }
        segmentStart = ++i;
      } else {
        if (charCode === CharCodes.Pathless) {
          type = "_";
        } else if (charCode === CharCodes.Dynamic) {
          type = pattern.charCodeAt(i + 1) === 36 ? "$$" : "$";
        }

        current ??= basePaths.map((path) => ({
          ...path,
          segments: path.segments.slice(),
        }));

        i = len;
        for (const char of delimiters) {
          const index = pattern.indexOf(char, segmentStart);
          if (index >= 0 && index < i) {
            i = index;
          }
        }
      }
    } while (i < len);

    if (escapeStart) {
      throw new Error(
        `Invalid route pattern: unclosed escape '${pattern.slice(escapeStart)}' in '${pattern}'`,
      );
    }
    if (group && charCode !== CharCodes.GroupEnd) {
      throw new Error(
        `Invalid route pattern: group was not closed '${pattern.slice(
          group,
        )}' in '${pattern}'`,
      );
    }

    if (!current) {
      segmentEnd(
        basePaths.map((path) => ({
          ...path,
          segments: path.segments.slice(),
        })),
        escaped,
        undefined,
        pathMap,
      );
    } else {
      segmentEnd(
        current,
        escaped + pattern.slice(segmentStart, i),
        type,
        pathMap,
      );
    }

    return [...pathMap.values()];
  }

  function segmentEnd(
    paths: Path[],
    raw: string,
    type: "_" | "$" | "$$" | undefined,
    map?: Map<string, Path>,
  ) {
    let segment: Segment | undefined;
    if (raw) {
      segment = {
        raw,
        name: normalizeSegment(raw),
        type,
      };

      if (type === "$" || type === "$$") {
        segment.name = type;
        segment.param = normalizeParam(raw.slice(type.length));
      }
    }

    for (const path of paths) {
      if (segment) {
        if (path.isCatchall) {
          throw new Error(
            `Invalid route pattern: nested segments are not allowed after a catch-all parameter. Found '.' following '${pattern.slice(
              0,
              i,
            )}' in '${pattern}'.`,
          );
        }

        path.segments.push(segment);
        //if (type !== "_") {
        path.id += path.id === "/" ? segment.name : `/${segment.name}`;
        //}
        if (type === "$$") {
          path.isCatchall = true;
        }
      }

      if (map) {
        if (map.has(path.id)) {
          const existing = map.get(path.id)!;
          const existingExpansion = existing.segments
            .map((s) => s.raw)
            .join(".");
          const currentExpansion = path.segments.map((s) => s.raw).join(".");
          throw new Error(
            `Invalid route pattern: route '${path.id}' is ambiguous. Expansion '${currentExpansion}' collides with '${existingExpansion}' in '${pattern}'.`,
          );
        }
        map.set(path.id, path);
      }
    }
  }
}

function normalizeParam(segment: string) {
  const normalized = normalizeSegment(segment);
  return /^\$/.test(normalized) ? `\`${normalized}\`` : normalized;
}

function normalizeSegment(segment: string) {
  return decodeURIComponent(segment).replace(
    /[/?#]/g,
    (char) => "%" + char.charCodeAt(0).toString(16),
  );
}
