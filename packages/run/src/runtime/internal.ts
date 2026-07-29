/// <reference types="marko" />

import { createHmac, randomBytes } from "node:crypto";

import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  MultipartParseError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { httpVerbs } from "../vite/constants";
import { bindClaimSet, reserveClaimSetId, resolveClaimSet } from "./claim-sets";
import type {
  Awaitable,
  RouteHandler,
  RouteHandlerResult,
} from "./legacy-types";
import {
  acceptsPatch,
  applyPersistedResponseHeaders,
  type ClaimSetBase,
  createPatchMismatchResponse,
  decodeClaimSetRequest,
  decodeEcho,
  encodeClaimSetAck,
  fingerprintValues,
  matchesPatchRequest,
  mergeValueFeedback,
  patchResponseContentType,
  persistedHeaders,
} from "./persisted-protocol";
import thenable from "./thenable";
import type {
  Context,
  FormBodyValidatorOptions,
  HandlerFunction,
  HandlerOptions,
  HttpVerb,
  HttpVerbOrAll,
  JsonBodyValidatorOptions,
  NextFunction,
  NormalizedHandler,
  NormalizedHandlerOptions,
  Platform,
  RouteMatch,
  Validator,
} from "./types";
import { href } from "./url-builder";

export { getMetaDataLookup as normalizeMeta } from "../vite/utils/meta-data";

// Registered rather than unique: a build can load more than one copy of this
// module, and the sentinels must compare equal across all of them.
export const NotHandled: typeof MarkoRun.NotHandled = Symbol.for(
  "Run.Response.NotHandled",
) as any;
export const NotMatched: typeof MarkoRun.NotMatched = Symbol.for(
  "Run.Response.NotMatched",
) as any;

// Private request facts forwarded to Marko's per-render options, not `$global`.
interface MarkoRenderOptions {
  persisted?: Omit<PersistedRequest, "buildId" | "claimSet"> & {
    token?: (identity: string) => string;
    onFeedback?: (delta: string) => void;
  };
}

// Identities are opaque on the wire: an application key never leaves the
// server, and a token from one build never resolves against another. The
// secret is per-process (cryptographically random when unset), so a fleet
// must set MARKO_RUN_INSTANCE_SECRET for its members to agree; without it
// a client's echo simply misses whenever a different worker answers.
const instanceEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const configuredInstanceSecret = instanceEnv?.MARKO_RUN_INSTANCE_SECRET;
const instanceSecret =
  configuredInstanceSecret || randomBytes(32).toString("base64url");
let warnFallbackSecret =
  !configuredInstanceSecret &&
  !!instanceEnv?.NODE_ENV &&
  instanceEnv.NODE_ENV !== "development";
// HMAC-SHA-256 keyed by the secret: observed tokens reveal nothing about
// the secret or any other identity's token. Truncating to 32 bits keeps
// the previous wire width, and stays safe because a token alone elides
// nothing — content digests co-gate every elision, so a forged or
// colliding token can only ever miss (re-ship bytes), never corrupt.
function computeInstanceToken(secret: string, identity: string) {
  return createHmac("sha256", secret)
    .update(identity)
    .digest()
    .readUInt32BE(0)
    .toString(36);
}
// Purely a memo: `instanceToken` is deterministic, so a dropped entry is
// recomputed identically. Identities are per item, per param and per user,
// so an uncapped map grows for the life of the process.
const INSTANCE_TOKEN_CAP = 10_000;
const instanceTokens = new Map<string, string>();
function instanceToken(identity: string) {
  let token = instanceTokens.get(identity);
  if (token === undefined) {
    if (warnFallbackSecret) {
      warnFallbackSecret = false;
      console.warn(
        "MARKO_RUN_INSTANCE_SECRET is not set: persisted instance tokens " +
          "use a per-process random secret, so a multi-worker or restarted " +
          "deployment never matches a client's echo and every navigation " +
          "re-ships content it could have elided.",
      );
    }
    token = computeInstanceToken(instanceSecret, identity);
    // Insertion-ordered, so the first key is the least recently added.
    if (instanceTokens.size >= INSTANCE_TOKEN_CAP) {
      instanceTokens.delete(instanceTokens.keys().next().value!);
    }
    instanceTokens.set(identity, token);
  }
  return token;
}

/** Test seam: the memo is process-global, so suites must start clean. */
export function resetInstanceTokens() {
  instanceTokens.clear();
}

/** Test seam: proves the memo stays bounded without exposing its contents. */
export function instanceTokenMemoSize() {
  return instanceTokens.size;
}

export const instanceTokenForTest = instanceToken;

/** Test seam: the PRF with an explicit secret, pinning the construction. */
export const computeInstanceTokenForTest = computeInstanceToken;

// Mirrors Marko's persisted contract without depending on its runtime types;
// `buildId` stays run-side, echoed on patch responses rather than forwarded.
export interface PersistedRequest {
  buildId: string;
  patch?: PersistedPatch;
  /** The E2 channel facts for this response: an id reserved before
   * rendering, the base the server resolved (acked to the client, with
   * the e1 base's fingerprint), and the materialized store that base
   * names — the merge base bound to the id once `onFeedback` fires. */
  claimSet?: { id: string; base: ClaimSetBase; store?: string; fp?: string };
}

type PersistedPatch = {
  fromRoute: string;
  targetRoute: string;
  heldRegions?: (token: string) => string | undefined;
  heldShells?: (id: string) => boolean;
  /** The request echo's value-claim section; the runtime elides claimed
   * groups whose digests hold (same-route only, enforced marko-side). */
  echoValues?: string;
};

declare global {
  /** Build-static shell possession per route, appended to the built server
   * entries by the browser build (absent in dev: full shells ship). */

  var __MARKO_RUN_SHELLS__: Record<string, string[]> | undefined;
}

// The client provably registers the target route's static persisted closure
// before it applies a frame (`navigate` awaits the entry), so its shells
// need no wire entry and no echo bytes. The memo keys on the manifest
// object so a replaced global (rebuild in a live process) never serves a
// stale hold set.
let heldShellSets = new Map<string, Set<string>>();
let heldShellManifest: Record<string, string[]> | undefined;
function heldShellsForRoute(route: string) {
  const manifest = globalThis.__MARKO_RUN_SHELLS__;
  if (manifest !== heldShellManifest) {
    heldShellManifest = manifest;
    heldShellSets = new Map();
  }
  const ids = manifest?.[route];
  if (!ids) return;
  let held = heldShellSets.get(route);
  if (!held) heldShellSets.set(route, (held = new Set(ids)));
  return (id: string) => held.has(id);
}

const persistedRequestLookup = new WeakMap<Context, PersistedRequest>();

/** @internal Marks a generated-router request as part of persisted pages. */
export function setPersisted(context: Context, persisted: PersistedRequest) {
  persistedRequestLookup.set(context, persisted);
}

function getPersistedRoute(
  persistedRoutes: readonly unknown[],
  route: string | undefined,
) {
  return route && /^(?:0|[1-9]\d*)$/.test(route) && persistedRoutes[+route]
    ? { route }
    : undefined;
}

/** @internal Initializes and negotiates one generated-router request. */
export function initializePersisted(
  context: Context,
  routeId: number | undefined,
  buildId: string,
  persistedRoutes: readonly unknown[],
): Response | undefined {
  const targetPersisted =
    routeId !== undefined && persistedRoutes[routeId] !== undefined;
  if (targetPersisted) {
    setPersisted(context, { buildId });
  }

  const { request } = context;
  const { method } = request;
  if (
    routeId !== undefined &&
    (method === "GET" || method === "HEAD" || method === "POST") &&
    acceptsPatch(request)
  ) {
    const targetRoute = "" + routeId;
    const source = getPersistedRoute(
      persistedRoutes,
      request.headers.get(persistedHeaders.from) || undefined,
    );
    if (
      targetPersisted &&
      source &&
      matchesPatchRequest(request, routeId, buildId)
    ) {
      // A malformed or oversize echo decodes to nothing: every claim it
      // carried becomes a miss and the patch ships complete.
      const echo = decodeEcho(request.headers.get(persistedHeaders.echo));
      let echoValues = echo?.values;
      // Claim-set channel (E2): base resolution is same-route only (marko
      // refuses cross-route claims, so a cross-route id is ignored and the
      // next store is route-clean). Known id → the exact store it names;
      // else the hedged enumerated records actually transmitted; else empty.
      // Either non-empty base is fingerprinted in the ack so the client can
      // prove the server merged from the base it believes it sent.
      let base: ClaimSetBase = "empty";
      let store: string | undefined;
      let fp: string | undefined;
      if (source.route === targetRoute) {
        const requestId = decodeClaimSetRequest(
          request.headers.get(persistedHeaders.claimSet),
        );
        const resolved =
          requestId && resolveClaimSet(buildId, source.route, requestId);
        if (requestId && typeof resolved === "string") {
          base = "hit";
          echoValues = store = resolved;
          fp = fingerprintValues(requestId);
        } else if (echoValues) {
          base = "e1";
          store = echoValues;
          fp = fingerprintValues(echoValues);
        }
      }
      const claimSet: PersistedRequest["claimSet"] = {
        id: reserveClaimSetId(buildId, targetRoute),
        base,
        store,
        fp,
      };
      setPersisted(context, {
        buildId,
        patch: {
          fromRoute: source.route,
          targetRoute,
          heldRegions: echo?.regions,
          heldShells: heldShellsForRoute(targetRoute),
          echoValues,
        },
        claimSet,
      });
    } else if (method !== "POST") {
      // Mutations still reach their handler; mismatched reads fail before rendering.
      return createPatchMismatchResponse();
    }
  }
}

const parentContextLookup = new WeakMap<Request, Context>();

const pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

// Persisted pages vary on `accept`; patches are newline-delimited script frames.
const persistedPageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8", vary: "accept" },
};

// Kept in sync with `applyPersistedResponseHeaders`: a patch is
// personalized by construction, so it is uncacheable everywhere and keys
// on every negotiation input it varies with.
const patchResponseInit = {
  status: 200,
  headers: {
    "cache-control": "private, no-store",
    "cdn-cache-control": "no-store",
    "content-type": patchResponseContentType,
    vary: `accept, ${persistedHeaders.echo}, ${persistedHeaders.claimSet}, ${persistedHeaders.build}, ${persistedHeaders.route}, ${persistedHeaders.from}`,
  },
};

globalThis.MarkoRun ??= {
  NotHandled,
  NotMatched,
};

globalThis.Run ??= {
  href,
  ALL: createDefineHandler("ALL"),
  ...Object.fromEntries(
    httpVerbs.map((v) => {
      const verb = v.toUpperCase() as HttpVerb;
      return [v.toUpperCase(), createDefineHandler(verb)];
    }),
  ),
} as any;

type Rendered = ReturnType<Marko.Template["render"]> & AsyncIterable<string>;

// Registry key for the raw render carried on a page `Response`; also read by
// `adapter/middleware`, which is bundled separately.
const kRender = Symbol.for("@marko/run.render");

// Marks an error as a client fault; `call()` answers with a bare response of
// this status instead of letting it surface as a server error.
const kErrorStatus = Symbol.for("@marko/run.errorStatus");

let toReadable = (rendered: Rendered): ReadableStream<Uint8Array> => {
  toReadable = (rendered as any).toReadable
    ? (rendered) => rendered.toReadable!()
    : (rendered) => {
        let cancelled = false;
        return new ReadableStream({
          async start(ctrl) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of rendered) {
                if (cancelled) {
                  return;
                }
                ctrl.enqueue(encoder.encode(chunk));
              }
              ctrl.close();
            } catch (err) {
              if (!cancelled) {
                ctrl.error(err);
              }
            }
          },
          cancel() {
            cancelled = true;
          },
        });
      };
  return toReadable(rendered);
};

export function createContext(
  route: RouteMatch | null,
  request: Request,
  platform: Platform,
  url: URL = new URL(request.url),
): Context {
  const context: Context = {
    route: route?.path || "",
    method: request.method as HttpVerb,
    meta: route?.meta || {},
    body:
      route && request.body && (route.options.json || route.options.form)
        ? thenable(() => readBody(route, context))
        : undefined,
    data: {},
    url,
    request,
    platform,
    parent: parentContextLookup.get(request),
    serializedGlobals: {
      params: true,
      url: true,
    },
    get params() {
      const value = route
        ? route.options.params
          ? route.options.params(route.params as Record<string, any>)
          : route.params
        : {};
      Object.defineProperty(context, "params", {
        configurable: true,
        enumerable: true,
        value,
      });
      return value;
    },
    get search() {
      const search = searchParamsToObject(url.searchParams);
      const value = route?.options.search
        ? route.options.search(search)
        : search;
      Object.defineProperty(context, "search", {
        configurable: true,
        enumerable: true,
        value,
      });
      return value;
    },
    async fetch(resource, init) {
      const request = new Request(
        typeof resource === "string" ? new URL(resource, url) : resource,
        init,
      );

      parentContextLookup.set(request, context);
      return (
        (await globalThis.__marko_run__.fetch(request, platform)) ||
        new Response(null, { status: 404 })
      );
    },
    render<T>(
      template: Marko.Template<T>,
      input: T,
      init: ResponseInit = pageResponseInit,
    ) {
      const persisted = persistedRequestLookup.get(context);
      let options: MarkoRenderOptions | undefined;
      const patch = persisted?.patch;
      // Preserve custom response data while reapplying framework-owned headers.
      const customInit = !!persisted && init !== pageResponseInit;
      if (persisted) {
        if (!customInit) {
          init = patch ? patchResponseInit : persistedPageResponseInit;
        }
        const claimSet = patch && persisted.claimSet;
        options = {
          persisted: {
            patch,
            token: instanceToken,
            // Bind the reserved id to the final store only when the render
            // completes (marko fires this once, empty delta included); an
            // aborted stream leaves the id an unbound miss.
            onFeedback:
              claimSet &&
              ((delta) =>
                bindClaimSet(
                  persisted.buildId,
                  patch.targetRoute,
                  claimSet.id,
                  delta
                    ? mergeValueFeedback(claimSet.store, delta)
                    : (claimSet.store ?? ""),
                )),
          },
        };
      }

      let response: Response;
      if (context.method === "HEAD") {
        response = new Response(null, init);
      } else {
        // Ambient Marko 5 types omit Marko 6's per-render options overload.
        const rendered = (
          template.render as (
            input: Marko.TemplateInput<T>,
            options?: MarkoRenderOptions,
          ) => ReturnType<Marko.Template<T>["render"]>
        )({ ...input, $global: context as unknown as Marko.Global }, options);

        // Older/custom renders that cannot be iterated directly go through
        // `toReadable`.
        if (!(Symbol.asyncIterator in (rendered as object))) {
          response = new Response(toReadable(rendered), init);
        } else {
          // Created eagerly so marko attaches its error handling now: a lazy body
          // nobody reads (a HEAD request) would otherwise throw uncaught.
          const iterator = rendered[Symbol.asyncIterator]();
          response = new Response(toResponseBody(iterator), init);
          // Lets the node adapter write the HTML strings straight to the socket.
          // `body` pins the stream, since `clone()` drains the single-use render.
          (response as any)[kRender] = {
            render: { [Symbol.asyncIterator]: () => iterator },
            body: response.body,
          };
        }
      }

      // The client executes a patch body only when this echo names its build.
      if (patch) {
        response.headers.set(persistedHeaders.build, persisted!.buildId);
        // The ack states which base this render merged from; the id was
        // reserved before rendering, so a plain header (streaming-safe,
        // proxy-strippable without harm) carries both. A HEAD request never
        // renders, so its reserved id stays unbound — acking it would hand
        // the client an id that always misses.
        const claimSet = context.method !== "HEAD" && persisted!.claimSet;
        if (claimSet) {
          response.headers.set(
            persistedHeaders.claimSet,
            encodeClaimSetAck(claimSet.id, claimSet.base, claimSet.fp),
          );
        }
      }
      return customInit
        ? applyPersistedResponseHeaders(response, !!patch)
        : response;
    },
    redirect(to, status = 302) {
      if (typeof status !== "number") {
        throw new RangeError(`Invalid status code ${status}`);
      } else if (
        status < 301 ||
        status > 308 ||
        (status > 303 && status < 307)
      ) {
        throw new RangeError(`Invalid status code ${status}`);
      }
      return new Response(null, {
        status,
        headers: {
          location: (typeof to === "string" ? new URL(to, url) : to).href,
        },
      });
    },
    back(fallback = "/", status) {
      return context.redirect(
        request.headers.get("referer") || fallback,
        status,
      );
    },
  };
  return context;
}

export function render<T>(
  context: Context,
  template: Marko.Template<T>,
  input: T,
  data?: Record<string, unknown>,
) {
  if (data) {
    Object.assign(context.data, data);
  }
  return context.render(template, input);
}

const handlerMethod = new WeakMap<HandlerFunction, HttpVerb | false>();

type NextDataFunction = (data?: Record<string, unknown>) => Response;

export async function call(
  handler: HandlerFunction,
  next: NextFunction,
  context: Context,
  data?: Record<string, unknown>,
): Promise<Response> {
  let response!: RouteHandlerResult;

  if (data) {
    Object.assign(context.data, data);
  }

  let method = handlerMethod.get(handler);
  if (method === undefined) {
    handlerMethod.set(
      handler,
      (method =
        "verb" in handler && handler.verb !== "ALL"
          ? (handler.verb as HttpVerb)
          : false),
    );
  }

  if (method && method !== context.method) {
    // HEAD is served by the auto-generated head<N> entry, which delegates to
    // get<N> and suppresses the body.  call() must not then skip GET-stamped
    // handlers when context.method is "HEAD"; an explicit HEAD export gets its
    // own entry so there is no risk of double-running it.
    if (!(method === "GET" && context.method === "HEAD")) {
      return (next as any as NextDataFunction)(data);
    }
  }

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    let nextCallCount = 0;
    let didThrow = false;
    try {
      response = await handler(context, ((d) => {
        nextCallCount++;
        return next(d);
      }) as NextFunction);
    } catch (error) {
      didThrow = true;
      if (error == null) {
        throw NotHandled;
      } else if (error instanceof Response) {
        return error;
      } else if (typeof error === "object" && kErrorStatus in error) {
        return new Response(null, { status: (error as any)[kErrorStatus] });
      }
      throw error;
    } finally {
      if (!response && !didThrow && nextCallCount > 0) {
        console.warn(
          `Handler '${handler.name}' called its next function but no response was returned. ` +
            "This will cause the next function to be called again which is wasteful. " +
            "Either return or throw the result of calling `next`, return or throw a " +
            "new Response object or finally `throw null` to skip handling the request",
        );
      } else if (nextCallCount > 1) {
        console.warn(
          `Handler '${handler.name}' called its next function more than once. ` +
            "Make sure this is intentional because it is inefficient.",
        );
      }
    }

    if (
      response &&
      response !== NotHandled &&
      response !== NotMatched &&
      !(response instanceof Response)
    ) {
      // Left alone this reaches the adapter, which fails reading `headers`
      // off it and names its own internals rather than the handler.
      throw new Error(
        `${handler.name ? `Handler '${handler.name}'` : "A handler"} for ${context.method} ${context.route} returned a value of type "${typeof response}" instead of a Response. ` +
          "Return `Response.json(value)` to send JSON, return a `new Response(...)`, or call `next()` to continue.",
      );
    }
  } else {
    try {
      response = await handler(context, next);
    } catch (error) {
      if (error == null) {
        throw NotHandled;
      } else if (error instanceof Response) {
        return error;
      } else if (typeof error === "object" && kErrorStatus in error) {
        return new Response(null, { status: (error as any)[kErrorStatus] });
      }
      throw error;
    }
  }

  if (response === null || response === NotMatched || response === NotHandled) {
    throw response || NotMatched;
  }
  return response || (next as any as NextDataFunction)(data);
}

export function compose(handlers: HandlerFunction[]): HandlerFunction {
  const len = handlers.length;
  if (!len) {
    return createPassthroughHandler();
  } else if (len === 1) {
    return handlers[0];
  }
  return (context, next) => {
    let i = 0;
    return (function nextHandler(data) {
      return i < len
        ? call(handlers[i++], nextHandler, context, data)
        : (next as any as NextDataFunction)(data);
    })();
  };
}

export function normalizeHandler(
  obj: RouteHandler | RouteHandler[] | Promise<RouteHandler | RouteHandler[]>,
  verb?: string,
): RouteHandler {
  if (typeof obj === "function") {
    assertExportedVerb(obj, verb);
    return obj;
  } else if (Array.isArray(obj)) {
    for (const handler of obj) {
      if (typeof handler !== "function") {
        // Left alone, an object element crashes on the first request and a
        // primitive trips the `in` probe below with an opaque TypeError.
        throw new Error(
          `Expected every element of the ${verb ? `${verb} export of a handler` : "middleware default export"} to be a function, but one was ${typeof handler}`,
        );
      }
      assertExportedVerb(handler, verb);
    }
    return compose(obj as HandlerFunction[]) as RouteHandler;
  } else if (obj instanceof Promise) {
    const promise = obj.then((value) => {
      fn = normalizeHandler(value, verb);
    });
    // The rejection still reaches whoever calls the handler; this only keeps
    // it from surfacing as unhandled before the first call.
    promise.catch(passthrough);
    let fn: RouteHandler = async (context, next) => {
      await promise;
      return fn(context, next);
    };
    return (context, next) => fn(context, next);
  } else if (obj) {
    // Verb discovery goes by export name alone, so a truthy non-function
    // would register the route and then quietly answer 204.
    throw new Error(
      `Expected the ${verb ? `${verb} export of a handler` : "middleware default export"} to be a function or array of functions, but it was ${typeof obj}`,
    );
  }
  return passthrough;
}

export function assertHandlerVerb(
  verb: HttpVerbOrAll,
  handler: HandlerFunction,
) {
  if ("verb" in handler && handler.verb !== verb) {
    throw new Error(
      `Expected verb ${verb} but handler was defined with Run.${handler.verb}`,
    );
  }
}

export function normalizeValidator<T>(validator: Validator<T> | undefined) {
  if (!isValidator(validator)) {
    // Anything else means no validator. Wrapping it would not throw here but
    // on the first validation, which is a far more confusing place.
    return undefined;
  }
  if (typeof validator === "function") {
    return validator;
  }
  return (input: T) => {
    const result = validator["~standard"].validate(input);
    if (result instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }
    return result.issues ? [input, result.issues] : [result.value, undefined];
  };
}

const defaultMaxBytes = 1024 * 1024;
const defaultMaxParts = 1000;
const defaultMaxFiles = 20;

export function mergeOptions(
  ...arr: (
    | NormalizedHandler<Context, "ALL", any, HandlerOptions>
    | HandlerFunction
    | HandlerOptions
  )[]
) {
  const merged: HandlerOptions = {};
  for (const item of arr) {
    let options: HandlerOptions;
    if (typeof item === "object") {
      options = item;
    } else if ("options" in item) {
      options = item.options;
    } else {
      continue;
    }
    for (const k in options) {
      const key = k as keyof typeof options;
      const option = options[key];
      if (typeof option === "object" && typeof merged[key] === "object") {
        Object.assign(merged[key], option);
      } else if (option) {
        merged[key] = option as any;
      }
    }
  }

  const result = {
    params: normalizeValidator(merged.params),
    search: normalizeValidator(merged.search),
  } as NormalizedHandlerOptions;

  if (merged.json) {
    const { maxBytes = defaultMaxBytes, validator } = isValidator(merged.json)
      ? { validator: merged.json }
      : typeof merged.json === "object"
        ? merged.json
        : // Any other truthy value — `json: true` in an untyped project —
          // enables parsing with the defaults.
          ({} as JsonBodyValidatorOptions);
    result.json = {
      maxBytes,
      validator: normalizeValidator(validator),
    };
  }

  if (merged.form) {
    const {
      maxBytes,
      maxFiles = defaultMaxFiles,
      maxFileBytes = defaultMaxBytes,
      maxParts = defaultMaxParts,
      onFile,
      validator,
    } = isValidator(merged.form)
      ? { validator: merged.form }
      : typeof merged.form === "object"
        ? merged.form
        : ({} as FormBodyValidatorOptions<Context>);
    result.form = {
      maxBytes: maxBytes ?? maxFiles * maxFileBytes,
      maxFileBytes,
      maxFiles,
      maxParts,
      onFile,
      validator: normalizeValidator(validator),
    };
  }

  return result;
}

export function stripResponseBodySync(response: Response): Response {
  return response.body ? new Response(null, response) : response;
}

export function stripResponseBody(
  response: Awaitable<Response>,
): Awaitable<Response> {
  return "then" in response
    ? response.then(stripResponseBodySync)
    : stripResponseBodySync(response);
}

export function passthrough() {}

export function noContent() {
  return new Response(null, {
    status: 204,
  });
}

export function notHandled() {
  throw null;
}

export function notMatched() {
  return null;
}

// A lazy body, so constructing the `Response` pulls nothing and the node adapter
// can take the render instead (see `kRender`). Must stay `iterator`'s only reader.
function toResponseBody(
  iterator: AsyncIterator<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>(
    {
      // `next()` does not always return a promise, and a rejected `pull`
      // errors the stream, which is what the failure should do anyway.
      async pull(ctrl) {
        const { done, value } = await iterator.next();
        if (done) ctrl.close();
        else ctrl.enqueue(encoder.encode(value));
      },
      async cancel(reason) {
        // An abandoned render's cleanup failure has nowhere to surface, and
        // unhandled it would take the process down on a mid-render disconnect.
        try {
          await iterator.return?.(reason);
        } catch {
          // ignored
        }
      },
    },
    { highWaterMark: 0 },
  );
}

function searchParamsToObject(params: URLSearchParams | FormData) {
  const obj: Record<string, any> = {};
  for (const [key, value] of params) {
    if (key in obj) {
      const prev = obj[key];
      obj[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

// Failures here are the client's fault, so they throw status-stamped errors
// (see `kErrorStatus`) instead of surfacing as server errors.
// Fatal decode, so malformed UTF-8 is a client error rather than U+FFFD noise.
const bodyDecoder = new TextDecoder("utf-8", { fatal: true });

async function readBodyWithLimit(request: Request, maxBytes: number) {
  let bytes: ArrayBuffer | Uint8Array;

  if (maxBytes < 0) {
    bytes = await request.arrayBuffer();
  } else {
    const contentLength = request.headers.get("content-length");

    if (contentLength !== null && Number(contentLength) > maxBytes) {
      throw clientError("Request body too large", 413);
    }

    if (!request.body) {
      throw clientError("Missing request body", 400);
    }

    const reader = request.body.getReader();
    const buffer = new Uint8Array(maxBytes);
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (receivedBytes + value.byteLength > maxBytes) {
          await reader.cancel();
          throw clientError("Request body too large", 413);
        }

        buffer.set(value, receivedBytes);
        receivedBytes += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }

    bytes = buffer.subarray(0, receivedBytes);
  }

  try {
    return bodyDecoder.decode(bytes);
  } catch (error) {
    throw clientError("Invalid request body encoding", 400, error);
  }
}

// The `Content-Type` media type, normalized per RFC 9110: parameters dropped,
// case-insensitive. `undefined` when the request carries no content type.
function getMediaType(request: Request) {
  return request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
}

// Stamps the thrown error itself when there is one, keeping its message and
// stack; `message` describes the failure for everything else.
function clientError(message: string, status: number, thrown?: unknown) {
  const error = thrown instanceof Error ? thrown : new Error(message);
  (error as any)[kErrorStatus] = status;
  return error;
}

async function readBody(route: RouteMatch, context: Context) {
  const { request } = context;
  const mediaType = getMediaType(request);
  if (route.options.json && mediaType === "application/json") {
    const { maxBytes = defaultMaxBytes, validator } = route.options.json;
    let json;
    try {
      json = JSON.parse(await readBodyWithLimit(request, maxBytes));
    } catch (error) {
      if (typeof error === "object" && error && kErrorStatus in error)
        throw error;
      throw clientError("Invalid JSON body", 400, error);
    }
    return validator ? validator(json) : json;
  }
  const isMultipart = mediaType === "multipart/form-data";
  if (
    !route.options.form ||
    !(isMultipart || mediaType === "application/x-www-form-urlencoded")
  ) {
    throw clientError("Unsupported content type", 415);
  }
  const {
    maxParts = defaultMaxParts,
    maxFiles = defaultMaxFiles,
    maxFileBytes = defaultMaxBytes,
    maxBytes = maxFiles * maxFileBytes,
    onFile,
    validator,
  } = route.options.form;
  let data;
  try {
    data = searchParamsToObject(
      isMultipart
        ? await parseFormData(
            request,
            {
              maxParts,
              maxFiles,
              maxFileSize: maxFileBytes,
              maxTotalSize: maxBytes,
            },
            onFile ? (file) => onFile!(context, file) : undefined,
          )
        : new URLSearchParams(await readBodyWithLimit(request, maxBytes)),
    );
  } catch (error) {
    if (
      error instanceof MaxFilesExceededError ||
      error instanceof MaxFileSizeExceededError ||
      error instanceof MaxPartsExceededError ||
      error instanceof MaxTotalSizeExceededError
    ) {
      throw clientError("Request body too large", 413, error);
    }
    if (
      error instanceof FormDataParseError ||
      error instanceof MultipartParseError
    ) {
      throw clientError("Invalid form body", 400, error);
    }
    // Anything else — an `onFile` handler failure, a thrown `Response` — is
    // not a malformed-body case and keeps its meaning.
    throw error;
  }
  return validator ? validator(data) : data;
}

// A handler whose verb disagrees with its export never runs — the runtime gates
// on the handler's own verb and answers 204. `Run.ALL` passes any method.
function assertExportedVerb(
  handler: RouteHandler | HandlerFunction,
  verb?: string,
) {
  if (
    verb &&
    "verb" in handler &&
    handler.verb !== verb &&
    handler.verb !== "ALL"
  ) {
    throw new Error(
      `The ${verb} export of a handler was defined with Run.${handler.verb} — it would never run, since the runtime only invokes it for ${handler.verb} requests`,
    );
  }
}

function createDefineHandler<Verb extends HttpVerbOrAll>(verb: Verb) {
  return (
    optionsOrHandlers: HandlerOptions | HandlerFunction | HandlerFunction[],
    handlers: undefined | HandlerFunction | HandlerFunction[],
  ) => {
    let handler: NormalizedHandler<Context, HttpVerbOrAll, any, HandlerOptions>;

    if (typeof optionsOrHandlers === "function") {
      assertHandlerVerb(verb, optionsOrHandlers);
      const _fn = optionsOrHandlers;
      handler = ((ctx: Context, next: NextFunction) => _fn(ctx, next)) as any;
      handler.options = (_fn as any).options ?? {};
    } else if (Array.isArray(optionsOrHandlers)) {
      for (const h of optionsOrHandlers) assertHandlerVerb(verb, h);
      handler = compose(optionsOrHandlers) as any;
      handler.options = mergeOptions(...optionsOrHandlers);
    } else if (typeof handlers === "function") {
      assertHandlerVerb(verb, handlers);
      const _fn = handlers;
      handler = ((ctx: Context, next: NextFunction) => _fn(ctx, next)) as any;
      handler.options = mergeOptions(_fn, optionsOrHandlers);
    } else if (Array.isArray(handlers)) {
      for (const h of handlers) assertHandlerVerb(verb, h);
      handler = compose(handlers) as any;
      handler.options = mergeOptions(...handlers, optionsOrHandlers);
    } else {
      handler = createPassthroughHandler() as any;
      handler.options = mergeOptions(optionsOrHandlers);
    }

    handler.verb = verb;

    return handler;
  };
}

// The object check comes first so the `in` probe never runs on a primitive,
// which throws.
function isValidator(option: unknown): option is Validator<any> {
  return (
    typeof option === "function" ||
    (typeof option === "object" && option !== null && "~standard" in option)
  );
}

function createPassthroughHandler(): HandlerFunction {
  return (_ctx, next) => next();
}
