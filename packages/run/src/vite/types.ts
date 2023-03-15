import type { RoutableFileType, HttpVerb, RoutableFileTypes } from "./constants";
import type { Options as MarkoViteOptions} from "@marko/vite";
import type { ResolvedConfig, UserConfig, InlineConfig } from "vite";
import type { SpawnedServer } from "./utils/server";

export type { RoutableFileType, HttpVerb };

export type StartServer = (port?: number) => Promise<void>;

export interface AdapterConfig {
  [name: PropertyKey]: any
}

export interface Adapter {
  readonly name: string;
  configure?(config: AdapterConfig): void;
  pluginOptions?(options: Options): Promise<Options> | Options | undefined;
  viteConfig?(config: UserConfig): Promise<UserConfig> | UserConfig | undefined;
  getEntryFile?(): Promise<string> | string;
  startDev?(config: InlineConfig, port: number, envFile?: string): Promise<SpawnedServer> | SpawnedServer;
  startPreview?(dir: string, entry?: string, port?: number, envFile?: string): Promise<SpawnedServer> | SpawnedServer;
  buildEnd?(config: ResolvedConfig, routes: Route[], builtEntries: string[], sourceEntries: string[]): Promise<void> | void;
  typeInfo?(writer: (data: string) => void): Promise<string> | string
}

export interface RouterOptions {
  trailingSlashes: 'Ignore' | 'RedirectWithout' | 'RedirectWith' | 'RewriteWithout' | 'RewriteWith'
}

export interface MarkoServeOptions extends Partial<RouterOptions> {
  routesDir?: string;
  emitRoutes?(routes: Route[]): void | Promise<void>;
  adapter?: Adapter | null;
}

export type Options = MarkoServeOptions & MarkoViteOptions

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
  id: string;
  name: string;
  type: RoutableFileType;
  filePath: string;
  relativePath: string;
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
  middleware: RoutableFile[];
}
