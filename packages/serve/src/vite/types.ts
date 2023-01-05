import type { RoutableFileType, HttpVerb, RoutableFileTypes } from "./constants";
import type { Options as MarkoViteOptions} from "@marko/vite";
import type { ResolvedConfig, UserConfig } from "vite";

export type { RoutableFileType, HttpVerb };


export type StartServer = (port?: number) => Promise<void>;
export interface Adapter {
  readonly name: string;
  pluginOptions?(options: Options): Promise<Options> | Options | undefined;
  viteConfig?(config: UserConfig): Promise<UserConfig> | UserConfig | undefined;
  getEntryFile?(): Promise<string> | string;
  startDev?(configFile: string, port: number): Promise<void> | void;
  startPreview?(dir: string, entry: string, cmd?: string, port?: number): Promise<void> | void;
  buildEnd?(config: ResolvedConfig, routes: Route[], builtEntries: string[], sourceEntries: string[]): Promise<void> | void;
}

export interface MarkoServeOptions {
  routesDir?: string;
  emitRoutes?(routes: Route[]): void | Promise<void>;
  adapter?: Adapter
  codegen?: CodegenOptions
}

export interface CodegenOptions {
  trailingSlashes: 'Ignore' | 'RedirectWithout' | 'RedirectWith' | 'RewriteWithout' | 'RewriteWith'
}

export type Options = MarkoServeOptions & MarkoViteOptions;

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

export interface BuildInfo {
  entryFile: string
}