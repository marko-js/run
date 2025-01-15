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
    const delimiters = group ? ").," : ".,";
    let charCode: number;
    let segmentStart = i;
    let type: "_" | "$" | "$$" | undefined;
    let current: Path[] | undefined;

    do {
      /*
        Char Codes
          $: 36
          (: 40
          ): 41
          ,: 44
          .: 46
          _: 95
      */
      charCode = pattern.charCodeAt(i);
      if (charCode === 41 && group) {
        break;
      } else if (charCode === 44) {
        if (!current) {
          segmentEnd(
            basePaths.map((path) => ({
              ...path,
              segments: path.segments.slice(),
            })),
            "",
            "_",
            pathMap,
          );
        } else {
          segmentEnd(current, pattern.slice(segmentStart, i), type, pathMap);
        }
        current = undefined;
        type = undefined;
        segmentStart = ++i;
      } else if (charCode === 46) {
        if (current) {
          segmentEnd(current, pattern.slice(segmentStart, i), type);
        }
        type = undefined;
        segmentStart = ++i;
      } else if (charCode === 40) {
        const groupPaths = parse(current || basePaths, ++i);
        if (groupPaths.length) {
          current = groupPaths;
        }
        segmentStart = ++i;
      } else {
        if (charCode === 95) {
          type = "_";
        } else if (charCode === 36) {
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

    if (group && charCode !== 41) {
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
        "",
        "_",
        pathMap,
      );
    } else {
      segmentEnd(current, pattern.slice(segmentStart, i), type, pathMap);
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
        name: raw,
        type,
      };

      if (type === "$" || type === "$$") {
        segment.name = type;
        segment.param = raw.slice(type.length);
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
