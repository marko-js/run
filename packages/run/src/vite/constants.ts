type ValuesOf<T> = T[keyof T];

export const markoRunFilePrefix = "__marko-run__";

export const virtualFilePrefix = "virtual:marko-run";
export const persistedAppFilename = `${markoRunFilePrefix}app.marko`;

// no support for "connect" or "trace" verbs
export const httpVerbs = [
  "get",
  "head",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "query",
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
