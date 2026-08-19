/// <reference types="marko" />

import type { StandardSchemaV1 } from "@standard-schema/spec";
/** Function validator. Its return value becomes the validated result; throw a `Response` to reject. */
export type ValidatorFn<T = unknown> = (input: T) => any;
/** A Standard Schema (e.g. valibot) or a function validator. */
export type Validator<T = unknown> = StandardSchemaV1<T> | ValidatorFn<T>;
export type JsonBodyValidator = Validator<unknown> | JsonBodyValidatorOptions;
export type JsonBodyValidatorOptions = {
  /** Validates the parsed JSON body; its result is `ctx.body`. Without one the option only sets limits and `ctx.body` stays `undefined`. */
  validator?: Validator<unknown>;
  /** Maximum body size in bytes. Larger requests are rejected with a 413. */
  maxBytes?: number;
};
export type FormBodyValidator<Ctx> =
  | Validator<Record<string, any>>
  | FormBodyValidatorOptions<Ctx>;
export type FormBodyValidatorOptions<Ctx> = {
  /** Validates the parsed form fields; its result is `ctx.body`. Without one the option only sets limits and `ctx.body` stays `undefined`. */
  validator?: Validator<Record<string, any>>;
  /** Maximum total body size in bytes; defaults to `maxFiles * maxFileBytes`. Larger requests are rejected with a 413. */
  maxBytes?: number;
  /** Maximum number of uploaded files in a multipart body. */
  maxFiles?: number;
  /** Maximum number of parts in a multipart body. */
  maxParts?: number;
  /** Maximum size of each uploaded file in bytes. */
  maxFileBytes?: number;
  /** Called for each uploaded file in a multipart body. */
  onFile?(ctx: Ctx, file: Multipart): any;
};
export interface Empty {}

/** Result of a Standard Schema validator: `[value, undefined]` on success, `[input, issues]` on failure. */
export type Schema<I, O> =
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
type HttpVerbWithBody = "POST" | "PUT" | "PATCH" | "QUERY";
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
      : Empty;
type MergeTuple<T extends readonly any[]> = T extends readonly [
  infer A,
  infer B,
  ...infer Rest,
]
  ? MergeTuple<[MergeTwo<A, B>, ...Rest]>
  : T extends readonly [infer Only]
    ? IsPlainObject<Only> extends true
      ? Only
      : Empty
    : Empty;
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
> = Simplify<{
  [K in Keys[number]]: string;
}>;
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
  [K in HttpVerb]: IsPlainObject<T> extends true
    ? NormalizedMetaObject<T, K>
    : T;
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

export interface RouteDef<
  Path extends string = string,
  Verb extends HttpVerb = HttpVerb,
  Meta = unknown,
  Partials extends Record<string, unknown> = Record<string, unknown>,
  Options = unknown,
> {
  path: Path;
  method: Verb;
  meta: Meta;
  partials: Partials;
  params: unknown extends Options
    ? unknown
    : Options extends [
          {
            params: infer T;
          },
        ]
      ? T
      : PathParams<Path>;
  search: unknown extends Options
    ? unknown
    : Options extends [
          {
            search: infer T;
          },
        ]
      ? T
      : undefined;
  form: unknown extends Options
    ? never
    : Options extends [
          {
            form: infer T;
          },
        ]
      ? Verb extends HttpVerbWithBody
        ? Promise<T>
        : undefined
      : never;
  json: unknown extends Options
    ? never
    : Options extends [
          {
            json: infer T;
          },
        ]
      ? Verb extends HttpVerbWithBody
        ? Promise<T>
        : undefined
      : never;
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
export interface Route<Def extends RouteDef = RouteDef, Data = unknown> {
  path: Def["path"];
  method: Def["method"];
  meta: Def["meta"];
  params: Def["params"];
  search: Def["search"];
  body: Fallback<
    Def["json"],
    Fallback<
      Def["form"],
      [Extract<Def["method"], HttpVerbWithBody>] extends [never]
        ? undefined
        : undefined | Promise<unknown>
    >
  >;
  data: Data extends [infer T extends Record<string, unknown>]
    ? T
    : Record<string, unknown>;
}
type RouteFileGroupVerb<Group extends RouteFileGroup> =
  | (Keys<Group["handler"]["exports"]> & HttpVerb)
  | (Group["template"] extends [] ? never : "GET");
type RouteFileGroupMeta<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = Fallback<MergeTuple<NormalizedMetaFiles<Group["meta"], Verb>>, Empty>;
type RouteFileGroupOptions<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = MergeHandlerOptionsTuple<
  MapTuple<
    TypesFromHandlerFiles<[...Group["middleware"], Group["handler"]], Verb>,
    "options",
    Empty
  >
>;
type RouteFileGroupData<
  Group extends RouteFileGroup,
  Verb extends HttpVerb,
> = MergeTuple<
  MapTuple<
    TypesFromHandlerFiles<[...Group["middleware"], Group["handler"]], Verb>,
    "data",
    Empty
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
      options: Fallback<Validation<RouteFileGroupOptions<Group, Verb>>, Empty>;
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
          : Record<string, unknown>,
        RouteOptionsContainer<Path, Verb>
      >;
    };
  };
};
export type DefinePaths<Groups extends Record<string, RouteFileGroup>> = {
  [Path in keyof Groups & string]: DefineRoute<Path, Groups[Path]>;
};
type ExtractHandlerData<U> =
  U extends Typed<
    {},
    {
      data: infer Data;
    }
  >
    ? Data
    : never;
type HandlerDataUnionKeys<U> = U extends unknown ? keyof U : never;
type HandlerDataUnionValue<U, K extends PropertyKey> = U extends unknown
  ? K extends keyof U
    ? U[K]
    : never
  : never;
type HandlerDataRequiredKeys<U> = {
  [K in HandlerDataUnionKeys<U>]: [U] extends [
    {
      [P in K]-?: unknown;
    },
  ]
    ? K
    : never;
}[HandlerDataUnionKeys<U>];
type MergeHandlerData<U> = Simplify<
  {
    [K in HandlerDataRequiredKeys<U>]: HandlerDataUnionValue<U, K>;
  } & {
    [K in Exclude<
      HandlerDataUnionKeys<U>,
      HandlerDataRequiredKeys<U>
    >]?: HandlerDataUnionValue<U, K>;
  }
>;
type HandlerFuncData<T> =
  Awaited<T> extends Response | null
    ? never
    : MergeHandlerData<ExtractHandlerData<Awaited<T>>>;
export interface NormalizedHandlerFunction<
  Verb extends HttpVerbOrAll,
  Options,
> extends HandlerFunction<Context<any>, Promise<Response>> {
  options: Options;
  verb: Verb;
}
export type NormalizedHandler<
  Ctx,
  Verb extends HttpVerbOrAll,
  Return,
  Options,
> = Typed<
  NormalizedHandlerFunction<Verb, Options>,
  HandlerTypes<
    Ctx,
    Verb,
    Options,
    [Return] extends [readonly unknown[]]
      ? MergeTuple<{
          [I in keyof Return]: HandlerFuncData<Return[I]>;
        }>
      : HandlerFuncData<Return>
  >
>;
type HandlerArray<Ctx, Return extends unknown[]> = {
  [K in keyof Return]:
    | {
        [__run__.TYPES]: {
          options: any;
          data: any;
        };
      }
    | HandlerFunction<Ctx, Return[K]>;
};
type HandlerValueOptions<H> = H extends {
  [__run__.TYPES]: {
    options: infer O;
  };
}
  ? O
  : never;
type ComposedHandlerOptions<Handlers extends readonly unknown[]> =
  MergeHandlerOptionsTuple<{
    [K in keyof Handlers]: HandlerValueOptions<Handlers[K]>;
  }>;

type HandlerPassthrough<H> = [H] extends [never]
  ? true
  : H extends { [__run__.TYPES]: { passthrough: infer P } }
    ? P
    : true;

type HandlerValueData<H> = H extends {
  [__run__.TYPES]: {
    data: infer D;
  };
}
  ? D
  : H extends (...args: any[]) => infer R
    ? HandlerFuncData<R>
    : Empty;
type ComposedHandlerData<Handlers extends readonly unknown[]> = MergeTuple<{
  [K in keyof Handlers]: HandlerValueData<Handlers[K]>;
}>;
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
    ? HandlerTypes<Context, Verb, Options>
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
    Empty
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
  Empty
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
    : Empty;
  params: MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
    params: infer T;
  }
    ? T
    : PathParams<Path & string>;
  search: MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
    search: infer T;
  }
    ? T
    : undefined;
  body: Verb extends HttpVerbWithBody
    ? MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
        json: infer T;
      }
      ? Promise<T>
      : MergedRouteOptionsForFile<Path, Verb, F["id"], Options> extends {
            form: infer T;
          }
        ? Promise<T>
        : undefined
    : undefined;
  data: GetUpstreamData<F, Path, Verb> extends [
    infer T extends Record<string, unknown>,
  ]
    ? T
    : Record<string, unknown>;
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
/**
 * A verb helper on the global `Run` namespace (`Run.GET`, `Run.POST`, ...,
 * and `Run.ALL` in middleware). Accepts a handler function or array of
 * handlers, optionally preceded by validation options:
 *
 *     export const POST = Run.POST({ json: NoteSchema }, async (ctx, next) => {
 *       const [note, issues] = await ctx.body; // parsed and validated
 *       if (issues) return Response.json({ issues }, { status: 422 });
 *       return next({ note }); // renders the page; data becomes $global.data
 *     });
 *
 * Declare request bodies with the `json`/`form` options and read them from
 * `ctx.body`; the validator both checks and types it, while
 * `ctx.request.json()`/`.formData()` bypass validation and size limits. A
 * validator is a Standard Schema (e.g. valibot) or a function that returns
 * the typed body and throws a `Response` to reject. Return `null` from a
 * handler to fall through to the 404 page.
 *
 * @see `@marko/run/cheatsheet.md` (in `node_modules`) for the full routing,
 * handler, and validation conventions.
 */
export type DefineHandler<F extends File, Verb extends HttpVerbOrAll> = {
  <const Handlers extends readonly unknown[], Return extends unknown[]>(
    handlers: HandlerArray<
      ContextForFileWithOptions<F, Verb, Empty> & {},
      Return
    > &
      Handlers,
  ): Typed<
    NormalizedHandlerFunction<Verb, ComposedHandlerOptions<Handlers>>,
    HandlerTypes<
      ContextForFileWithOptions<F, Verb, Empty> & {},
      Verb,
      ComposedHandlerOptions<Handlers>,
      ComposedHandlerData<Handlers>
    >
  >;
  <
    const Options extends DefineHandlerOptions<
      Verb,
      ContextForFileWithOptions<F, Verb, Empty> & {}
    >,
    const Handlers extends readonly unknown[],
    Return extends unknown[],
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, Empty> & {}>
    >,
    handlers: HandlerArray<
      ContextForFileWithOptions<F, Verb, Options> & {},
      Return
    > &
      Handlers,
  ): Typed<
    NormalizedHandlerFunction<
      Verb,
      MergeHandlerOptions<ComposedHandlerOptions<Handlers>, Options>
    >,
    HandlerTypes<
      ContextForFileWithOptions<F, Verb, Options> & {},
      Verb,
      MergeHandlerOptions<ComposedHandlerOptions<Handlers>, Options>,
      ComposedHandlerData<Handlers>
    >
  >;
  <Return>(
    handler: HandlerFunction<
      ContextForFileWithOptions<F, Verb, Empty> & {},
      Return
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, Empty> & {},
    Verb,
    Return,
    {}
  >;
  <
    const Options extends DefineHandlerOptions<
      Verb,
      ContextForFileWithOptions<F, Verb, Empty> & {}
    >,
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, Empty> & {}>
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
      ContextForFileWithOptions<F, Verb, Empty> & {}
    >,
    Return,
  >(
    options: Exact<
      Options,
      DefineHandlerOptions<Verb, ContextForFileWithOptions<F, Verb, Empty> & {}>
    >,
    handler: HandlerFunction<
      NoInfer<ContextForFileWithOptions<F, Verb, Options>> & {},
      Return
    >,
  ): NormalizedHandler<
    ContextForFileWithOptions<F, Verb, Options> & {},
    Verb,
    Return,
    Options
  >;
};

/**
 * The untyped fallback for a `Run` verb helper, used before the generated
 * `.marko-run/routes.d.ts` narrows `Run` per route file.
 *
 * @see `@marko/run/cheatsheet.md` (in `node_modules`) for the full routing,
 * handler, and validation conventions.
 */
export type GlobalDefineHandler<Verb extends HttpVerbOrAll> = {
  <const Handlers extends readonly unknown[], Return extends unknown[]>(
    handlers: HandlerArray<Context, Return> & Handlers,
  ): Typed<
    NormalizedHandlerFunction<Verb, Empty>,
    HandlerTypes<Context, Verb, Empty, ComposedHandlerData<Handlers>>
  >;
  <Return>(
    handler: HandlerFunction<Context, Return>,
  ): NormalizedHandler<Context, Verb, Return, {}>;
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
                Empty
              >
            >
          : Empty;
      }>,
    ]
  : Empty;
type HandlerReturnValue =
  | void
  | undefined
  | null
  | Response
  | Typed<Response, any>
  | typeof MarkoRun.NotHandled
  | typeof MarkoRun.NotMatched;
type HandlerReturn = HandlerReturnValue | Promise<HandlerReturnValue>;
/**
 * A middleware or handler function. Return a `Response` to send it, nothing
 * to have `next()` called for you, or `null` to fall through to the 404 page.
 */
export type HandlerFunction<Ctx = Context, Return = HandlerReturn> = (
  ctx: Ctx,
  next: NextFunction,
) => Return extends HandlerReturn ? Return : HandlerReturn;
export interface HandlerOptionsWithoutBody {
  /** Validates and can transform path parameters. The validator's result becomes `ctx.params` and types it. */
  params?: Validator<Record<string, any>>;
  /** Validates and can transform the query string. The validator's result becomes `ctx.search` and types it. */
  search?: Validator<Record<string, any>>;
}
export interface HandlerOptionsWithBody<Ctx> extends HandlerOptionsWithoutBody {
  /** Parses and validates `application/json` request bodies. The validator's result becomes `await ctx.body`, fully typed. */
  json?: JsonBodyValidator;
  /** Parses and validates url-encoded and multipart form bodies. The validator's result becomes `await ctx.body`, fully typed. */
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
/** An uploaded file from a multipart form body. */
export interface Multipart extends globalThis.File {
  /** Name of the form field the file was uploaded under. */
  fieldName: string;
}
// A body option without a validator (e.g. `{ maxBytes }` in middleware) only
// sets limits, so its key is dropped here and `body` stays `undefined` until
// some option in the chain provides the validator.
type HasBodyValidator<V> = V extends
  | StandardSchemaV1
  | ((...args: any[]) => any)
  | { validator: StandardSchemaV1 | ((...args: any[]) => any) }
  ? true
  : false;
type Validation<T> = Simplify<{
  [K in "params" | "search" | "form" | "json" as K extends keyof T
    ? K extends "form" | "json"
      ? T extends Record<K, infer Value>
        ? HasBodyValidator<Value> extends true
          ? K
          : never
        : never
      : K
    : never]: T extends Record<K, infer Value>
    ? Value extends { validator: infer U }
      ? Validated<U>
      : Validated<Value>
    : keyof T;
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
export type Typed<Original, Types> = ([Original] extends [
  {
    readonly [__run__.TYPES]: any;
  },
]
  ? Omit<Original, typeof __run__.TYPES>
  : Original) & {
  [__run__.TYPES]: Types;
};

export type NextResponse<Data = Empty> = Typed<
  Response,
  {
    data: Data;
    readonly [__run__.INVARIANT]: (data: Data) => void;
  }
>;

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
  Verb extends HttpVerbOrAll = F["type"] extends "template"
    ? "GET" | "POST" | "QUERY"
    : "ALL",
> = Union<{
  [Path in PathsForFile<F>]: Fallback<
    Union<{
      [V in VerbsForPath<Path, Verb> as F["type"] extends "template"
        ? HandlerPassthrough<
            AppPaths[Path]["files"]["handler"]["exports"][V]
          > extends true
          ? V
          : never
        : V]: V extends HttpVerb
        ? Context<
            Simplify<
              Route<
                AppPaths[Path]["verbs"][V]["def"],
                GetUpstreamData<F, Path, V>
              >
            >
          >
        : never;
    }>,
    Context
  >;
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
  Data = Empty,
> {
  context: Ctx;
  verb: Verb;
  options: Options;
  data: [Data] extends [never]
    ? Empty
    : Data extends Record<string, unknown>
      ? Data
      : Empty;
  passthrough: [Data] extends [never] ? false : true;
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
  [Verb in HttpVerbOrAll]: GlobalDefineHandler<Verb>;
} & NamespaceVerb;
export type Namespace<F extends File> = Typed<
  (F["type"] extends "middleware"
    ? {
        [Verb in HttpVerbOrAll]: DefineHandler<F, Verb>;
      }
    : F["type"] extends "handler"
      ? {
          [Verb in HttpVerb]: DefineHandler<F, Verb>;
        }
      : Empty) &
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
            {
              rawOptions: any;
              options: any;
              data: any;
              def: RouteDef;
            }
          >;
        }
      >;
};
/** Adapter-provided data on `ctx.platform`. Extend it by declaring a `Platform` interface on the `@marko/run` module. */
export interface Platform {}
/** The request context, `ctx` in middleware and handlers and `$global` in templates. */
export interface Context<T extends Route = Route> {
  /** Path pattern of the matched route, e.g. `/products/$id`. */
  readonly route: T["path"];
  /** HTTP method of the request. */
  readonly method: T["method"];
  /** Metadata from the route's `+meta` file. */
  readonly meta: T["meta"];
  /**
   * The validated value from the route's `params` validator: a function
   * validator's return value, or a `[value, issues]` tuple from a Standard
   * Schema. Without a validator, an object of the raw path segment strings.
   */
  readonly params: T["params"];
  /**
   * The validated value from the route's `search` validator: a function
   * validator's return value, or a `[value, issues]` tuple from a Standard
   * Schema. Without a validator, an object of the parsed query string
   * values, repeated keys becoming arrays.
   */
  readonly search: T["search"];
  /**
   * Promise for the parsed and validated request body when the route's
   * merged options include a `json` or `form` validator, otherwise
   * `undefined`. A Standard Schema validator resolves it to a
   * `[value, issues]` tuple.
   */
  readonly body: T["body"];
  /** Data passed to `next({ ... })` by upstream middleware and handlers. */
  readonly data: T["data"];
  /** Parsed URL of the request. */
  readonly url: URL;
  /** The incoming WHATWG request. */
  readonly request: Request;
  /** Data provided by the adapter, e.g. Node's `req`/`res`. */
  readonly platform: Platform;
  /** Context of the route that called `ctx.fetch`, if any. */
  readonly parent: Context | undefined;
  /** Which context properties serialize to the browser on `$global`. */
  serializedGlobals: Record<string, boolean>;
  /** Makes a request through the app's router, with the native `fetch` signature. */
  fetch(
    resource: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  /** Renders a Marko template to a streaming HTML response. */
  render<T>(
    template: Marko.Template<T>,
    input: T,
    init?: ResponseInit,
  ): Response;
  /** Creates a redirect response, resolving relative paths against the current URL. */
  redirect(to: string | URL, status?: number): Response;
  /** Redirects to the request referrer, or to `fallback` when there is none. */
  back(fallback?: string | URL, status?: number): Response;
}
/** Resolves the `Run.Context` type for a path pattern (e.g. `GetContext<"/products/*">`) or an imported route module. */
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

/**
 * Runs the rest of the chain and renders the page where applicable. Pass an
 * object to expose it downstream as `ctx.data` and `$global.data`.
 */
export type NextFunction = {
  (): Promise<NextResponse>;
  <Data extends Record<string, unknown>>(
    data: Data,
  ): Promise<NextResponse<Data>>;
};
/** Augmented by the generated `.marko-run/routes.d.ts` with the app's routes. */
export interface App {}
/** A matched route, as returned by `match`. */
export interface RouteMatch<Ctx extends Context = Context> {
  handler: HandlerFunction<Ctx, Promise<Response>>;
  path: Ctx["route"];
  params: Ctx["params"];
  options: NormalizedHandlerOptions<Ctx>;
  meta: Ctx["meta"];
}
/** Handles a request through the app's router. Resolves `undefined` when no route handled it. */
export type Fetch<TPlatform extends Platform = Platform> = (
  request: Request,
  platform: TPlatform,
) => Promise<Response | void>;
/** Synchronously matches a method and path to a route. */
export type Match = (method: string, pathname: string) => RouteMatch | null;
/** Creates a response for a route previously returned by `match`. */
export type Invoke<TPlatform extends Platform = Platform> = (
  route: RouteMatch | null,
  request: Request,
  platform: TPlatform,
  url?: URL,
) => Promise<Response | void>;
/** Shape of the `@marko/run/router` module, for embedding in an existing server. */
export interface RuntimeModule {
  fetch<TPlatform extends Platform = Platform>(
    ...args: Parameters<Fetch<TPlatform>>
  ): ReturnType<Fetch<TPlatform>>;
  match: Match;
  invoke<TPlatform extends Platform = Platform>(
    ...args: Parameters<Invoke<TPlatform>>
  ): ReturnType<Invoke<TPlatform>>;
}
type TemplateAPI<T> = T extends {
  "~api": infer API;
}
  ? API
  : keyof Exclude<
        Marko.Renderable,
        Marko.Template<any, any> | Marko.Body<any, any> | string
      > extends "content"
    ? "tags"
    : "class";
/** Input of a `+layout` template: `content` (tags API) or `renderBody` (class API). */
export type LayoutInput<F extends File> =
  TemplateAPI<F["module"]> extends "tags"
    ? {
        content: Marko.Body;
      }
    : {
        renderBody: Marko.Body;
      };
type GetRawSearchValidator<
  Path extends string,
  Verb extends HttpVerb = "GET",
> = Path extends keyof AppPaths
  ? Verb extends keyof AppPaths[Path]["verbs"]
    ? "search" extends keyof AppPaths[Path]["verbs"][Verb]["rawOptions"]
      ? AppPaths[Path]["verbs"][Verb]["rawOptions"]["search"]
      : never
    : never
  : never;
/** Values for a path's dynamic segments; catch-all (`$$`) params also accept arrays. */
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
  search?: {
    // `undefined` omits the entry; `null` serializes as a value.
    [K in keyof Valid<GetRawSearchValidator<Path>>]:
      | string
      | number
      | null
      | undefined;
  };
  hash?: string | number;
}
interface HrefParamsOptions<
  Path extends `${string}/$${string}`,
> extends HrefBaseOptions<Path> {
  params: HrefParams<Path>;
}
/** Builds a URL for an app route with typed path, params, search, and hash. */
export type Href<Verb extends HttpVerbOrAll = "ALL"> = {
  <Path extends PathsForVerb<Verb>>(
    path: Path,
    ...args: Path extends `${string}/$${string}`
      ? [options: HrefOptions<Path>]
      : [options?: HrefOptions<Path>]
  ): string;
};
