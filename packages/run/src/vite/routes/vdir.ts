import { RoutableFileTypes } from "../constants";
import type { Path, Segment } from "./parse";
import type { RoutableFile, RoutableFileType, PathInfo } from "../types";

export default class VDir {
  #dirs: Map<string, VDir> | undefined;
  #pathlessDirs: Map<string, VDir> | undefined;

  readonly parent: VDir | null;
  readonly source: Path | null;
  readonly path: string;
  readonly fullPath: string;
  readonly segment: Segment;
  files: Map<RoutableFileType, RoutableFile> | undefined;

  constructor();
  constructor(parent: VDir, segment: Segment, source: Path);
  constructor(parent?: VDir, segment?: Segment, source?: Path) {
    if (!parent || !segment) {
      this.parent = null;
      this.source = null;
      this.path = "/";
      this.fullPath = "/";
      this.segment = {
        raw: "",
        name: "",
      };
    } else {
      this.parent = parent;
      this.source = source!;
      this.path =
        parent.path + (parent.path === "/" ? segment.name : `/${segment.name}`);
      this.fullPath =
        parent.fullPath +
        (parent.fullPath === "/" ? segment.name : `/${segment.name}`);
      if (segment.param) {
        this.fullPath += segment.param;
      }
      this.segment = segment;
    }
  }

  get pathInfo() {
    const value: PathInfo = {
      id: "/",
      path: "/",
      segments: [],
    };

    let sep = "";
    for (const { segment } of this) {
      const { type, name, param } = segment;
      if (name && type !== "_") {
        value.id += sep + (type || name);
        value.path += sep + name;
        value.isEnd = type === "$$";
        if (param) {
          value.path += param;
          let index = type === "$$" ? null : value.segments.length;
          if (!value.params) {
            value.params = { [param]: index };
          } else if (!(param in value.params)) {
            value.params[param] = index;
          }
        }
        value.segments.push(name);
        sep = "/";
      }
    }

    Object.defineProperty(this, "pathInfo", {
      value,
      enumerable: true,
    });

    return value;
  }

  addDir(path: Path, segment: Segment): VDir {
    const map =
      segment.type === "_"
        ? (this.#pathlessDirs ??= new Map())
        : (this.#dirs ??= new Map());
    if (!map.has(segment.name)) {
      const dir = new VDir(this, segment, path);
      map.set(segment.name, dir);
      return dir;
    }
    return map.get(segment.name)!;
  }

  addFile(file: RoutableFile): void {
    if (!this.files) {
      this.files = new Map();
      this.files.set(file.type, file);
    } else if (!this.files.has(file.type)) {
      this.files.set(file.type, file);
    } else {
      const existing = this.files.get(file.type)!;
      if (existing !== file) {
        throw new Error(
          `Duplicate file type '${file.type}' added at path '${this.path}'. File '${file.filePath}' collides with '${existing.filePath}'.`
        );
      } else if (
        file.type === RoutableFileTypes.Page ||
        file.type === RoutableFileTypes.Handler
      ) {
        throw new Error(
          `Ambiguous path definitionroute '${this.path}' is defined multiple times by ${file.filePath}`
        );
      }
      throw new Error(`What to say, '${this.path}'.`);
    }
  }

  *dirs(): IterableIterator<VDir> {
    if (this.#pathlessDirs) {
      yield* this.#pathlessDirs.values();
    }
    if (this.#dirs) {
      yield* this.#dirs.values();
    }
  }

  *[Symbol.iterator](): IterableIterator<VDir> {
    if (this.parent) {
      yield* this.parent;
    }
    yield this;
  }

  static addPaths(roots: VDir[], paths: Path[]): VDir[] {
    const dirs: VDir[] = [];
    const unique = new Set<string>();
    for (const root of roots) {
      for (const path of paths) {
        let dir: VDir = root;
        for (const segment of path.segments) {
          dir = dir.addDir(path, segment);
        }
        if (unique.has(dir.path)) {
          const sources = new Set<string>();
          let sourcePath = "";
          for (const { source } of dir) {
            if (source && !sources.has(source.source)) {
              sources.add(source.source);
              sourcePath += source.source + "/";
            }
          }
          throw new Error(
            `Ambiguous directory structure: '${sourcePath}${path.source}' defines '${dir.path}' multiple times.`
          );
        } else {
          unique.add(dir.path);
          dirs.push(dir);
        }
      }
    }
    return dirs;
  }
}

