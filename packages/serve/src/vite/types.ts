import type { RoutableFileType, HttpVerb, RoutableFileTypes } from "./constants";

export type { RoutableFileType, HttpVerb };

export interface Route {
  key: string;
  index: number;
  path: string;
  params?: ParamInfo[],
  layouts: RoutableFile[];
  middleware: RoutableFile[];
  meta?: RoutableFile,
  handler?: RoutableFile;
  page?: RoutableFile;
  score: number;
}

export interface ParamInfo {
  name: string,
  index: number
}

export interface SpecialRoutes {
  [RoutableFileTypes.NotFound]?: Route,
  [RoutableFileTypes.Error]?: Route
}

export interface RoutableFile {
  name: string;
  type: RoutableFileType;
  filePath: string;
  importPath: string;
  verbs?: HttpVerb[];
}

export interface RouteTrie {
  key: string;
  route?: Route;
  catchAll?: Route
  static?: Map<string, RouteTrie>;
  dynamic?: RouteTrie,
}

export interface BuiltRoutes {
  list: Route[];
  special: SpecialRoutes;
}

