type ValuesOf<T> = T[keyof T];

export const markoRunFilePrefix = "__marko-run__";

export const virtualFilePrefix = "virtual:marko-run";

// no support for "connect" or "trace" verbs
export const httpVerbs = [
  "get",
  "head",
  "post",
  "put",
  "delete",
  "patch",
  "options",
] as const;

export const RoutableFileTypes = {
  Middleware: "middleware",
  Handler: "handler",
  Layout: "layout",
  Page: "page",
  NotFound: "404",
  Error: "500",
  Meta: "meta",
} as const;

export type RoutableFileType = ValuesOf<typeof RoutableFileTypes>;
export type HttpVerb = (typeof httpVerbs)[number];

/** Accept/content type that negotiates a patch instead of a document. */
export const patchContentType = "text/marko-patch";

/** Header carrying the build the browser holds, so a stale one is refused. */
export const buildIdHeader = "x-marko-run-build";
