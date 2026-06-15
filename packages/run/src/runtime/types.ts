/// <reference types="marko" />

import type { StandardSchemaV1 } from "@standard-schema/spec";
export type ValidatorFn<T = unknown> = (input: T) => any;
export type Validator<T = unknown> = StandardSchemaV1<T> | ValidatorFn<T>;
export type JsonBodyValidator = Validator<unknown> | JsonBodyValidatorOptions;
export type JsonBodyValidatorOptions = {
  validator?: Validator<unknown>;
  maxBytes?: number;
};
export type FormBodyValidator<Ctx> =
  | Validator<Record<string, any>>
  | FormBodyValidatorOptions<Ctx>;
export type FormBodyValidatorOptions<Ctx> = {
  validator?: Validator<Record<string, any>>;
  maxBytes?: number;
  maxFiles?: number;
  maxParts?: number;
  maxFileBytes?: number;
  onFile?(ctx: Ctx, file: Multipart): any;
};
type Schema<I, O> =
  | [O, undefined]
  | [I, StandardSchemaV1.FailureResult["issues"]];
type Validated<V, Default = unknown> =
  V extends StandardSchemaV1<infer I, infer O>
    ? Schema<I, O>
    : V extends (...args: any[]) => infer R
      ? R
      : Default;
type Valid<V, Default = unknown> =
  V extends StandardSchemaV1<infer I>
    ? I
    : V extends (...args: any[]) => infer R
      ? R
      : Default;
type HttpVerbWithoutBody = "GET" | "HEAD" | "DELETE" | "OPTIONS";
type HttpVerbWithBody = "POST" | "PUT" | "PATCH";
export type HttpVerb = HttpVerbWithoutBody | HttpVerbWithBody;
export type HttpVerbOrAll = HttpVerb | "ALL";
type RouteFileType =
  | "handler"
  | "middleware"
  | "template"
  | "meta"
  | `@${string}`;
type RouteFileGroup = {
  all: File[];
  handler: File | never;
  template: File[];
  middleware: File[];
  meta: File[];
  partial: File[];
};
type Simplify<T> = {
  [Z in keyof T]: T[Z];
} & {};

// type Simplify<T> = T

type Keys<T> = [T] extends [never] ? never : keyof T;
type Union<T> = T[keyof T];
type IsPlainObject<T> = T extends object
  ? T extends (...args: any[]) => any
    ? false
    : T extends readonly any[]
      ? false
      : T extends Date
        ? false
        : true
  : false;
type Fallback<T, Value> = [T] extends [never] ? Value : T;
type MapTuple<
  T extends readonly any[],
  K extends keyof T[number],
  Value = never,
> = {
  [I in keyof T]: Fallback<T[I][K], Value>;
};
type FindTuple<
  T extends readonly unknown[],
  K extends PropertyKey,
  V,
> = T extends readonly [infer H, ...infer R]
  ? H extends Record<K, V>
    ? H
    : FindTuple<R, K, V>
  : never;
type FilterTuple<
  T extends readonly unknown[],
  K extends PropertyKey,
  V,
> = T extends readonly [infer H, ...infer R]
  ? H extends Record<K, V>
    ? [H, ...FilterTuple<R, K, V>]
    : FilterTuple<R, K, V>
  : [];
type MergeTwo<A, B> =
  IsPlainObject<A> extends true
    ? IsPlainObject<B> extends true
      ? Simplify<Omit<A, keyof B> & B>
      : B
    : IsPlainObject<B> extends true
      ? B
      : {};
type MergeTuple<T extends readonly any[]> = T extends readonly [
  infer A,
  infer B,
  ...infer Rest,
]
  ? MergeTuple<[MergeTwo<A, B>, ...Rest]>
  : T extends readonly [infer Only]
    ? IsPlainObject<Only> extends true
      ? Only
      : {}
    : {};
type MergeValidators<A, B> =
  IsPlainObject<A> extends true
    ? IsPlainObject<B> extends true
      ? Simplify<Omit<A, keyof B> & B>
      : A extends Record<"validator", Validator>
        ? Simplify<
            Omit<A, "validator"> & {
              validator: B;
            }
          >
        : B
    : B;
type MergeHandlerOptions<A, B> = [A] extends [never]
  ? B
  : [B] extends [never]
    ? A
    : {
        [K in keyof A | keyof B]: K extends keyof A
          ? K extends keyof B
            ? K extends "params" | "search" | "form" | "json"
              ? MergeValidators<A[K], B[K]>
              : B[K]
            : A[K]
          : K extends keyof B
            ? B[K]
            : never;
      };
type MergeHandlerOptionsTuple<T extends readonly any[]> = T extends readonly [
  infer A,
  infer B,
  ...infer Rest,
]
  ? MergeHandlerOptionsTuple<[MergeHandlerOptions<A, B>, ...Rest]>
  : T extends readonly [infer Only]
    ? Only
    : never;
type PathParamKeys<Path extends string> =
  Path extends `${infer _}$${infer Param}/${infer Rest}`
    ? [Unescape<Param>, ...PathParamKeys<Rest>]
    : Path extends `${infer _}$$${infer Param}`
      ? [Unescape<Param>]
      : Path extends `${infer _}$${infer Param}`
        ? [Unescape<Param>]
        : [];
type Unescape<Escaped extends string> = Escaped extends `\`${infer Value}\``
  ? Value
  : Escaped;
type PathParams<
  Path extends string,
  Keys extends string[] = PathParamKeys<Path>,
> = {
  [K in Keys[number]]: string;
};
type NormalizedMetaObject<Meta, Verb extends HttpVerb> =
  IsPlainObject<Meta> extends true
    ? Verb extends keyof Meta
      ? Simplify<Omit<Meta, HttpVerb | keyof Meta[Verb]> & Meta[Verb]>
      : Simplify<Omit<Meta, HttpVerb>>
    : never;
export type NormalizedMeta<Meta, Verb extends HttpVerb> =
  IsPlainObject<Meta> extends true
    ? {
        [K in Verb]: NormalizedMetaObject<Meta, K>;
      }[Verb]
    : Meta;
export type NormalizedMetaLookup<T> = {
  [K in HttpVerb]: IsPlainObject<T> extends 1 ? NormalizedMetaObject<T, K> : T;
};
type NormalizedMetaFiles<
  Files extends readonly File[],
  Verb extends HttpVerb,
> = {
  [I in keyof Files]: NormalizedMeta<Files[I]["exports"], Verb>;
};
type RouteFiles<Files extends readonly File[]> = {
  [Type in RouteFileType | "all" as Type extends `@${string}`
    ? "partial"
    : Type]: Type extends "all"
    ? Files
    : Type extends "handler"
      ? FindTuple<Files, "type", Type>
      : FilterTuple<Files, "type", Type>;
};
type ID = string | number;
interface File<
  Id extends ID = ID,
  Type extends RouteFileType = RouteFileType,
  Module = any,
> {
  id: Id;
  type: Type;
  name: Type extends `@${infer P}` ? P : Type;
  module: Module;
  exports: Type extends "handler"
    ? Module
    : "default" extends keyof Module
      ? Module["default"]
      : Module;
}
export type RouteData = Record<string, any>;
export interface RouteDef<
  Path extends string = string,
  Verb extends HttpVerb = HttpVerb,
  Meta = any,
  Partials extends Record<string, any> = Record<string, any>,
  Options = RouteOptionsContainer<Path, Verb>,
> {
  path: Path;
  method: Verb;
  meta: Meta;
  partials: Partials;
  params: Options extends [
    {
      params: infer T;
    },
  ]
    ? T
    : Simplify<PathParams<Path>>;
  search: Options extends [
    {
      search: infer T;
    },
  ]
    ? T
    : undefined;
  form: Verb extends HttpVerbWithBody
    ? Options extends [
        {
          form: infer T;
        },
      ]
      ? T
      : never
    : undefined;
  json: Verb extends HttpVerbWithBody
    ? Options extends [
        {
          json: infer T;
        },
      ]
      ? T
      : never
    : undefined;
}
type RouteOptionsContainer<
  Path extends string = string,
  Verb extends HttpVerb = HttpVerb,
> = [
  Path extends keyof AppPaths
    ? AppPaths[Path]["verbs"][Verb extends keyof AppPaths[Path]["verbs"]
        ? Verb
        : never]["options"]
    : never,
];
export interface Route<Def extends RouteDef = RouteDef, Data = any> {
  path: Def["path"];
  method: Def["method"];
  meta: Def["meta"];
  params: Def["params"];
  search: Def["search"];
  body: Fallback<Def["json"], Fallback<Def["form"], undefined>>;
  data: Data extends [infer T extends RouteData] ? T : RouteData;
}
type RouteFileGroupVerb<Group extends RouteFileGroup> =
  | (Keys<Group["handler"]["exports"]> & HttpVerb)
  | (Group["template"] extends [] ? never : "GET");
type RouteFileGroupMeta<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = Fallback<MergeTuple<NormalizedMetaFiles<Group["meta"], Verb>>, {}>;
type RouteFileGroupOptions<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = MergeHandlerOptionsTuple<
  MapTuple<
    TypesFromHandlerFiles<[...Group["middleware"], Group["handler"]], Verb>,
    "options",
    {}
  >
>;
type RouteFileGroupData<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = MergeTuple<
  MapTuple<
    TypesFromHandlerFiles<[...Group["middleware"], Group["handler"]], Verb>,
    "data",
    {}
  >
>;
type TypesFromHandlerFiles<Files extends File[], Verb extends HttpVerb> = {
  [I in keyof Files]: TypesFromHandlerFile<Files[I], Verb>;
};
type TypesFromHandlerFile<
  F extends File,
  Verb extends HttpVerb,
> = TypesFromHandler<
  F["type"] extends "handler" ? F["exports"][Verb] : F["exports"],
  Verb
>;
type TypesFromHandler<Handler, Verb extends HttpVerb> =
  Handler extends Typed<{}, infer Types>
    ? Types extends {
        verb: infer HVerb;
      }
      ? HVerb extends Verb | "ALL"
        ? Types
        : never
      : never
    : never;
type DefineRoute<Path extends string, Group extends RouteFileGroup> = {
  files: Group;
  verbs: {
    [Verb in RouteFileGroupVerb<Group>]: {
      rawOptions: RouteFileGroupOptions<Group, Verb>;
      options: Fallback<Validation<RouteFileGroupOptions<Group, Verb>>, {}>;
      data: RouteFileGroupData<Group, Verb>;
      def: RouteDef<
        Path,
        Verb,
        RouteFileGroupMeta<Group, Verb>,
        Verb extends "GET"
          ? {
              [File in Group["partial"][number] as File["name"] &
                string]: File["exports"];
            }
          : {}
      >;
    };
  };
};
type NextHandlerResult<Data> = Typed<
  Promise<Response>,
  {
    data: Data;
  }
>;
export type DefinePaths<Groups extends Record<string, RouteFileGroup>> = {
  [Path in keyof Groups & string]: DefineRoute<Path, Groups[Path]>;
};
type HandlerFuncData<T> =
  T extends Typed<
    {},
    {
      data: infer Data;
    }
  >
    ? Data
    : {};
export interface NormalizedHandlerFunction<
  Ctx,
  Options,
> extends HandlerFunction<Ctx, Promise<Response>> {
  options: Options;
}
export type NormalizedHandler<
  Ctx,
  Verb extends HttpVerbOrAll,
  Return,
  Options,
> = Typed<
  NormalizedHandlerFunction<Ctx, Options>,
  HandlerTypes<
    Ctx,
    Verb,
    Options,
    Return extends readonly unknown[]
      ? MergeTuple<{
          [I in keyof Return]: HandlerFuncData<Return[I]>;
        }>
      : HandlerFuncData<Return>
  >
>;
type HandlerArray<Ctx, Return extends unknown[]> = {
  [K in keyof Return]: HandlerFunction<Ctx, Return[K]>;
};
type Exact<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>;
type DefineHandlerOptions<Verb extends HttpVerbOrAll, Ctx> = [Verb] extends [
  HttpVerbWithoutBody,
]
  ? HandlerOptionsWithoutBody
  : HandlerOptionsWithBody<Ctx>;
type TypesFromHandlerFilesWithLocal<
  Files extends File[],
  Verb extends HttpVerb,
  Id extends ID,
  Options,
> = {
  [I in keyof Files]: Files[I] extends {
    id: Id;
  }
    ? HandlerTypes<Context, Verb, Options, {}>
    : TypesFromHandlerFile<Files[I], Verb>;
};
type RouteFileGroupOptionsWithLocal<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
  Id extends ID,
  Options,
> = MergeHandlerOptionsTuple<
  MapTuple<
    TypesFromHandlerFilesWithLocal<
      [...Group["middleware"], Group["handler"]],
      Verb,
      Id,
      Options
    >,
    "options",
    {}
  >
>;
type MergedRouteOptionsForFile<
  Path extends keyof AppPaths,
  Verb extends HttpVerb,
  Id extends ID,
  Options,
> = Fallback<
  Validation<
    RouteFileGroupOptionsWithLocal<AppPaths[Path]["files"], Verb, Id, Options>
  >,
  {}
>;
export interface RouteForFileDef<
  F extends File,
  Path extends keyof AppPaths,
  Verb extends HttpVerb,
  Options,
> {
  path: Path;
  method: Verb;
  meta: Verb extends keyof AppPaths[Path]["verbs"]
    ? AppPaths[Path]["verbs"][Verb]["def"]["meta"]
    : {};
  params: MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
    params: infer T;
  }
    ? T
    : Simplify<PathParams<Path & string>>;
  search: MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
    search: infer T;
  }
    ? T
    : undefined;
  body: Verb extends HttpVerbWithBody
    ? MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
        json: infer T;
      }
      ? T
      : MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
            form: infer T;
          }
        ? T
        : undefined
    : undefined;
  data: GetUpstreamData<F, Path, Verb> extends [infer T extends RouteData]
    ? T
    : RouteData;
}
type ContextForFileWithOptions<
  F extends File,
  Verb extends HttpVerbOrAll,
  Options,
> = Union<{
  [Path in PathsForFile<F>]: Union<{
    [V in VerbsForPath<Path, Verb>]: V extends HttpVerb
      ? Context<RouteForFileDef<F, Path & keyof AppPaths, V, Options>>
      : never;
  }>;
}>;
export type DefineHandler<F extends File, Verb extends HttpVerbOrAll> = {
  <Return>(
    handler: HandlerFunction<
      ContextForFileWithOptions<F, Verb, {}> & {},
      Return
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, {}> & {},
    Verb,
    Return,
    {}
  >;
  <
    const Options extends DefineHandlerOptions<
      Verb,
      ContextForFileWithOptions<F, Verb, {}> & {}
    >,
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, {}> & {}>
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, Options> & {},
    Verb,
    {},
    Options
  >;
  <
    const Options extends DefineHandlerOptions<
      Verb,
      ContextForFileWithOptions<F, Verb, {}> & {}
    >,
    Return,
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, {}> & {}>
    >,
    handler: HandlerFunction<
      ContextForFileWithOptions<F, Verb, Options> & {},
      Return
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, Options> & {},
    Verb,
    Return,
    Options
  >;
  <Return extends unknown[]>(
    handlers: HandlerArray<ContextForFileWithOptions<F, Verb, {}> & {}, Return>,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, {}> & {},
    Verb,
    Return,
    {}
  >;
  <
    const Options extends DefineHandlerOptions<
      Verb,
      ContextForFileWithOptions<F, Verb, {}> & {}
    >,
    Return extends unknown[],
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, {}> & {}>
    >,
    handlers: HandlerArray<
      ContextForFileWithOptions<F, Verb, Options> & {},
      Return
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, Options> & {},
    Verb,
    Return,
    Options
  >;
};
type TakeUntil<
  Arr extends any[],
  Id extends ID,
  Prev extends any[] = [],
> = Arr extends [infer A, ...infer Rest]
  ? A extends {
      id: Id;
    }
    ? Prev
    : TakeUntil<Rest, Id, [...Prev, A]>
  : [];
type GetUpstreamData<
  F extends File,
  Path extends PathsForFile<F>,
  Verb extends HttpVerbOrAll,
> = Path extends keyof AppPaths
  ? [
      Union<{
        [V in VerbsForPath<Path, Verb>]: V extends HttpVerb
          ? MergeTuple<
              MapTuple<
                TypesFromHandlerFiles<
                  F["type"] extends "template"
                    ? [
                        ...AppPaths[Path]["files"]["middleware"],
                        AppPaths[Path]["files"]["handler"],
                      ]
                    : TakeUntil<
                        [
                          ...AppPaths[Path]["files"]["middleware"],
                          AppPaths[Path]["files"]["handler"],
                        ],
                        F["id"]
                      >,
                  V
                >,
                "data",
                {}
              >
            >
          : {};
      }>,
    ]
  : {};
type HandlerReturnValue =
  | void
  | undefined
  | null
  | Response
  | typeof MarkoRun.NotHandled
  | typeof MarkoRun.NotMatched;
type HandlerReturn = HandlerReturnValue | Promise<HandlerReturnValue>;
export type HandlerFunction<Ctx = Context, Return = HandlerReturn> = (
  ctx: Ctx,
  next: NextFunction,
) => Return extends HandlerReturn ? Return : HandlerReturn;
export interface HandlerOptionsWithoutBody {
  params?: Validator<Record<string, any>>;
  search?: Validator<Record<string, any>>;
}
export interface HandlerOptionsWithBody<Ctx> extends HandlerOptionsWithoutBody {
  json?: JsonBodyValidator;
  form?: FormBodyValidator<Ctx>;
}
export type HandlerOptions<Ctx = Context> = [Ctx] extends [
  {
    method: HttpVerbWithoutBody;
  },
]
  ? HandlerOptionsWithoutBody
  : HandlerOptionsWithBody<Ctx>;
export type NormalizedHandlerOptions<Ctx extends Context = Context> = {
  params: ValidatorFn<Record<string, any>> | undefined;
  search: ValidatorFn<Record<string, any>> | undefined;
  json: Ctx["method"] extends HttpVerbWithoutBody
    ? undefined
    : {
        maxBytes: number;
        validator: ValidatorFn | undefined;
      };
  form: Ctx["method"] extends HttpVerbWithoutBody
    ? undefined
    : {
        maxBytes: number;
        maxFiles: number;
        maxParts: number;
        maxFileBytes: number;
        onFile: ((ctx: Ctx, file: Multipart) => any) | undefined;
        validator: ValidatorFn<Record<string, any>> | undefined;
      };
};
export interface Multipart extends globalThis.File {
  fieldName: string;
}
type Validation<T> = Simplify<{
  [K in "params" | "search" | "form" | "json" as K extends keyof T
    ? K
    : never]: T extends Record<K, infer Value> ? Validated<Value, 1> : keyof T;
}>;
type RoutesForFile<F extends File> = {
  [K in keyof AppPaths as F["id"] extends AppPaths[K]["files"]["all"][number]["id"]
    ? K
    : never]: AppPaths[K];
};
type PathsForFile<F extends File> = keyof RoutesForFile<F>;
type FilterContextByVerb<
  Ctx extends Context,
  Verb extends HttpVerbOrAll,
> = Verb extends HttpVerb
  ? Extract<
      Ctx,
      {
        method: Verb;
      }
    >
  : Ctx;
type MatchedPaths<Path> = Path extends string
  ? Path extends keyof AppPaths
    ? Path
    : Path extends `${infer Root}*`
      ? keyof AppPaths & `${Root}${string}`
      : keyof AppPaths
  : Path;
type AllVerbs = Union<{
  [Path in keyof AppPaths]: keyof AppPaths[Path]["verbs"];
}>;
type AvailableVerbs<Scope extends keyof AppPaths | object> =
  Scope extends string
    ? {
        [K in Scope]: keyof AppPaths[K]["verbs"];
      }[Scope]
    : Scope extends {
          Run: Typed<
            {},
            {
              context: {
                method: infer Verb extends HttpVerb;
              };
            }
          >;
        }
      ? Verb
      : Scope extends Typed<
            {},
            {
              context: {
                method: infer Verb extends HttpVerb;
              };
            }
          >
        ? Verb
        : never;
type ContextForPath<
  Path extends keyof AppPaths,
  Verb extends keyof AppPaths[Path]["verbs"] = keyof AppPaths[Path]["verbs"],
> = Verb extends HttpVerb
  ? Context<
      Simplify<
        Route<
          AppPaths[Path]["verbs"][Verb]["def"],
          [AppPaths[Path]["verbs"][Verb]["data"]]
        >
      >
    >
  : never;
export type Typed<Original, Types> = Original & {
  [" ~types"]: Types;
};
type VerbsForPath<
  Path extends keyof AppPaths,
  Verb extends HttpVerbOrAll = "ALL",
> = Verb extends HttpVerb
  ? keyof AppPaths[Path]["verbs"] & Verb
  : keyof AppPaths[Path]["verbs"];
export type PathsForVerb<Verb extends HttpVerbOrAll = "ALL"> =
  Verb extends HttpVerb
    ? Union<{
        [Path in keyof AppPaths as Verb extends keyof AppPaths[Path]["verbs"]
          ? Path
          : never]: Path;
      }>
    : keyof AppPaths;
export type ContextForFile<
  F extends File,
  Verb extends HttpVerbOrAll = F["type"] extends "template" ? "GET" : "ALL",
> = Union<{
  [Path in PathsForFile<F>]: Union<{
    [V in VerbsForPath<Path, Verb>]: V extends HttpVerb
      ? Context<
          Simplify<
            Route<
              AppPaths[Path]["verbs"][V]["def"],
              GetUpstreamData<F, Path, V>
            >
          >
        >
      : never;
  }>;
}>;

export type AppPaths = App extends {
  paths: infer Paths;
}
  ? Paths
  : DefineRoutes["paths"];
export interface HandlerTypes<
  Ctx = Context,
  Verb extends HttpVerbOrAll = HttpVerbOrAll,
  Options = HandlerOptions<Ctx>,
  Data = RouteData,
> {
  context: Ctx;
  verb: Verb;
  options: Options;
  data: Data extends RouteData ? Data : {};
}
export type Middleware<Id extends ID, Mod> = File<Id, "middleware", Mod>;
export type Handler<Id extends ID, Mod> = File<Id, "handler", Mod>;
export type Template<Id extends ID, Mod> = File<Id, "template", Mod>;
export type Meta<Id extends ID, Mod> = File<Id, "meta", Mod>;
export type PartialTemplate<Id extends ID, Name extends string, Mod> = File<
  Id,
  `@${Name}`,
  Mod
>;
export type NamespaceVerb<Verb extends HttpVerbOrAll = "ALL"> = {
  href: Href<Verb>;
};
export type GlobalNamespace = {
  [Verb in HttpVerbOrAll]: NamespaceVerb<Verb>;
} & NamespaceVerb;
export type Namespace<F extends File> = Typed<
  (F["type"] extends "middleware"
    ? {
        [Verb in HttpVerbOrAll]: DefineHandler<F, Verb> & NamespaceVerb<Verb>;
      }
    : F["type"] extends "handler"
      ? {
          [Verb in HttpVerb]: DefineHandler<F, Verb> & NamespaceVerb<Verb>;
        }
      : {
          [Verb in AllVerbs]: NamespaceVerb<Verb>;
        }) &
    NamespaceVerb,
  {
    context: ContextForFile<F> & {};
  }
>;

export type DefineRoutes<Paths = void> = {
  paths: [Paths] extends [Record<string, File[]>]
    ? DefinePaths<{
        [Path in keyof Paths & string]: RouteFiles<Paths[Path]>;
      }>
    : Record<
        string,
        {
          files: any;
          verbs: Record<
            HttpVerbOrAll,
            { rawOptions: any; options: any; data: any; def: RouteDef }
          >;
        }
      >;
};
export interface Platform {}
export interface Context<T extends Route = Route> {
  readonly route: T["path"];
  readonly method: T["method"];
  readonly meta: T["meta"];
  readonly params: T["params"];
  readonly search: T["search"];
  readonly body: T["body"];
  readonly data: T["data"];
  readonly url: URL;
  readonly request: Request;
  readonly platform: Platform;
  readonly serializedGlobals: Record<string, boolean>;
  readonly parent: Context | undefined;
  fetch(
    resource: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  render<T>(
    template: Marko.Template<T>,
    input: T,
    init?: ResponseInit,
  ): Response;
  redirect(to: string | URL, status?: number): Response;
  back(fallback?: string | URL, status?: number): Response;
}
export type GetContext<
  Scope extends keyof AppPaths | `*` | `/${string}*` | object = "*",
  Verb extends
    | AvailableVerbs<Scope extends string ? MatchedPaths<Scope> : Scope>
    | "ALL" = "ALL",
> = Scope extends string
  ? {
      [Path in MatchedPaths<Scope>]: Path extends keyof AppPaths
        ? ContextForPath<
            Path,
            Verb extends HttpVerb
              ? Verb & keyof AppPaths[Path]["verbs"]
              : keyof AppPaths[Path]["verbs"]
          >
        : never;
    }[MatchedPaths<Scope>]
  : Scope extends {
        Run: Typed<
          {},
          {
            context: infer Ctx extends Context;
          }
        >;
      }
    ? FilterContextByVerb<Ctx, Verb>
    : Scope extends Typed<
          {},
          {
            context: infer Ctx extends Context;
          }
        >
      ? FilterContextByVerb<Ctx, Verb>
      : never;
export type NextFunction = <Data extends RouteData = RouteData>(
  data?: Data,
) => NextHandlerResult<Data>;
export interface App {}
export interface RouteMatch<Ctx extends Context = Context> {
  handler: HandlerFunction<Ctx, Promise<Response>>;
  path: Ctx["route"];
  params: Ctx["params"];
  options: NormalizedHandlerOptions<Ctx>;
  meta: Ctx["meta"];
}
export type Fetch<TPlatform extends Platform = Platform> = (
  request: Request,
  platform: TPlatform,
) => Promise<Response | void>;
export type Match = (method: string, pathname: string) => RouteMatch | null;
export type Invoke<TPlatform extends Platform = Platform> = (
  route: RouteMatch | null,
  request: Request,
  platform: TPlatform,
) => Promise<Response | void>;
export interface RuntimeModule {
  fetch<TPlatform extends Platform = Platform>(
    ...args: Parameters<Fetch<TPlatform>>
  ): ReturnType<Fetch<TPlatform>>;
  match: Match;
  invoke<TPlatform extends Platform = Platform>(
    ...args: Parameters<Invoke<TPlatform>>
  ): ReturnType<Invoke<TPlatform>>;
}
type DefaultAPI = keyof Exclude<
  Marko.Renderable,
  Marko.Template<any, any> | Marko.Body<any, any> | string
> extends "content"
  ? "tags"
  : "class";
type TemplateAPI<T> = T extends {
  api: infer API;
}
  ? API
  : DefaultAPI;
export type LayoutInput<F extends File> =
  TemplateAPI<F["module"]> extends "tags"
    ? {
        content: Marko.Body;
      }
    : {
        renderBody: Marko.Body;
      };
type GetProperty<Obj, Prop> = Prop extends keyof Obj ? Obj[Prop] : never;
type GetRawSearchValidator<
  Path extends string,
  Verb extends HttpVerb = "GET",
> = Path extends keyof AppPaths
  ? Verb extends keyof AppPaths[Path]["verbs"]
    ? GetProperty<AppPaths[Path]["verbs"][Verb]["rawOptions"], "search">
    : never
  : never;
type ParamObject<T> = {
  [K in keyof T]: string | number;
};
export type HrefParams<Path extends `${string}/$${string}`> = {
  [Param in PathParamKeys<Path>[number]]: Path extends `${string}/$$${Param}`
    ? string | number | (string | number)[]
    : string | number;
};
export type HrefOptions<
  Path extends string = `${string}/$${string}` | `${string}/$$${string}`,
> = Path extends `${string}/$${string}`
  ? HrefParamsOptions<Path>
  : HrefBaseOptions<Path>;
interface HrefBaseOptions<Path extends string> {
  search?: ParamObject<Valid<GetRawSearchValidator<Path>>>;
  hash?: string | number;
}
interface HrefParamsOptions<
  Path extends `${string}/$${string}`,
> extends HrefBaseOptions<Path> {
  params: HrefParams<Path>;
}
export type Href<Verb extends HttpVerbOrAll = "ALL"> = {
  <Path extends PathsForVerb<Verb>>(
    path: Path,
    ...args: Path extends `${string}/$${string}`
      ? [options: HrefOptions<Path>]
      : [options?: HrefOptions<Path>]
  ): string;
};
export {};
