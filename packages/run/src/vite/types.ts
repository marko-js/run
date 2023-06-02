import type {
  RoutableFileType,
  HttpVerb,
  RoutableFileTypes,
} from "./constants";
import type { Options as MarkoViteOptions } from "@marko/vite";
import type { ResolvedConfig, UserConfig, InlineConfig } from "vite";
import type { SpawnedServer } from "./utils/server";

export type { RoutableFileType, HttpVerb };

export type StartServer = (port?: number) => Promise<void>;

export interface AdapterConfig {
  [name: PropertyKey]: any;
}

export interface StartOptions {
  cwd: string;
  args: string[];
  port?: number;
  envFile?: string;
}

export interface StartDevOptions extends StartOptions {}

export interface StartPreviewOptions extends StartOptions {
  dir: string;
}

export interface Adapter {
  readonly name: string;
  configure?(config: AdapterConfig): void;
  pluginOptions?(options: Options): Promise<Options> | Options | undefined;
  viteConfig?(config: UserConfig): Promise<UserConfig> | UserConfig | undefined;
  getEntryFile?(): Promise<string> | string;
  startDev?(
    entry: string | undefined,
    config: InlineConfig,
    options: StartDevOptions
  ): Promise<SpawnedServer> | SpawnedServer;
  startPreview?(
    entry: string | undefined,
    options: StartPreviewOptions
  ): Promise<SpawnedServer> | SpawnedServer;
  buildEnd?(
    config: ResolvedConfig,
    routes: Route[],
    builtEntries: string[],
    sourceEntries: string[]
  ): Promise<void> | void;
  typeInfo?(writer: (data: string) => void): Promise<string> | string;
}

export interface RouterOptions {
  trailingSlashes:
    | "Ignore"
    | "RedirectWithout"
    | "RedirectWith"
    | "RewriteWithout"
    | "RewriteWith";
}

export interface MarkoServeOptions extends Partial<RouterOptions> {
  routesDir?: string;
  emitRoutes?(routes: Route[]): void | Promise<void>;
  adapter?: Adapter | null;
}

export type Options = MarkoServeOptions & MarkoViteOptions;

export interface Route {
  key: string;
  index: number;
  paths: PathInfo[];
  layouts: RoutableFile[];
  middleware: RoutableFile[];
  meta?: RoutableFile;
  handler?: RoutableFile;
  page?: RoutableFile;
  entryName: string;
}

export interface PathInfo {
  id: string;
  path: string;
  segments: string[];
  params?: Record<string, number | null>;
  isEnd?: boolean;
}

export interface SpecialRoutes {
  [RoutableFileTypes.NotFound]?: Route;
  [RoutableFileTypes.Error]?: Route;
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

export interface BuiltRoutes {
  list: Route[];
  special: SpecialRoutes;
  middleware: RoutableFile[];
}

export interface PackageData {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
