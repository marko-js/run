import type { Options as MarkoViteOptions } from "@marko/vite";
import type { InlineConfig, ResolvedConfig, UserConfig } from "vite";

import type {
  HttpVerb,
  RoutableFileType,
  RoutableFileTypes,
} from "./constants";
import type { SpawnedServer } from "./utils/server";

export type { HttpVerb, RoutableFileType };

export type StartServer = (port?: number) => Promise<void>;

export interface AdapterConfig {
  root: string;
  isBuild: boolean;
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
  entry?: string;
}

export interface Adapter {
  readonly name: string;
  configure?(config: AdapterConfig): void;
  pluginOptions?(options: Options): Promise<Options> | Options | undefined;
  viteConfig?(config: UserConfig): Promise<UserConfig> | UserConfig | undefined;
  getEntryFile?(): Promise<string> | string;
  startDev?(event: {
    entry: string | undefined;
    config: InlineConfig;
    options: StartDevOptions;
  }): Promise<SpawnedServer> | SpawnedServer;
  startPreview?(event: {
    entry: string | undefined;
    options: StartPreviewOptions;
  }): Promise<SpawnedServer> | SpawnedServer;
  buildEnd?(event: {
    config: ResolvedConfig;
    routes: BuiltRoutes;
    builtEntries: string[];
    sourceEntries: string[];
  }): Promise<void> | void;
  typeInfo?(writer: (data: string) => void): Promise<string> | string;
  routesGenerated?(event: {
    routes: BuiltRoutes;
    virtualFiles: Map<string, string>;
    meta: RouteGenerationData;
  }): Promise<void> | void;
}

export interface RouterOptions {
  trailingSlashes:
    | "Ignore"
    | "RedirectWithout"
    | "RedirectWith"
    | "RewriteWithout"
    | "RewriteWith";
}

export interface MarkoRunOptions extends Partial<RouterOptions> {
  routesDir?: string;
  emitRoutes?(routes: Route[]): void | Promise<void>;
  adapter?: Adapter | null;
}

export type Options = MarkoRunOptions & MarkoViteOptions;

export interface Route {
  key: string;
  index: number;
  paths: PathInfo[];
  layouts: RoutableFile[];
  middleware: RoutableFile[];
  meta?: RoutableFile;
  handler?: RoutableFile;
  page?: RoutableFile;
  templateFilePath?: string;
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

export type BuiltRoutes = {
  list: Route[];
  special: SpecialRoutes;
  middleware: RoutableFile[];
};

export interface PackageData {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface RouteGenerationData {
  buildTime: number;
  renderTime: number;
}

export interface ExplorerData {
  meta: RouteGenerationData;
  routes: Record<string, Route>;
  files: Record<string, string>;
}
