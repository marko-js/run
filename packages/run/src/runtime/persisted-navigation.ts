/// <reference types="vite/client" />

/** The generated update module for one route. */
export interface UpdateEntry {
  default: (patch: unknown, live: unknown) => void;
  createUpdate: (
    merge: (patch: unknown, live: unknown) => void,
    liveRoot?: unknown,
  ) => (fills: unknown[]) => void;
  /** The renderer held at each live dynamic-tag hop. */
  have?: () => string;
}

/** Build-stable route id plus lazy template and update entries. */
export type RouteEntry = [
  id: number,
  loadTemplate: () => Promise<unknown>,
  loadUpdate: () => Promise<UpdateEntry>,
];

export type RouteMatcher = (pathname: string) => RouteEntry | null;

export type Mutation = [
  body: FormData | URLSearchParams,
  form: HTMLFormElement,
  submitter: HTMLElement | null,
];

export interface NavigationState {
  appliedUrl: string;
  buildHash: string;
  controller?: AbortController;
  currentId: number;
  resubmitting?: boolean;
}

type Fallback = (
  err: unknown,
  href: string,
  push: boolean,
  mutation?: Mutation,
  response?: Response,
) => void;

const patchAccept = "text/marko-patch";
const patchContentType = "text/javascript";

export async function navigate(
  state: NavigationState,
  href: string,
  push: boolean,
  target: RouteEntry,
  mutation: Mutation | undefined,
  fallback: Fallback,
) {
  const targetId = target[0];
  // GETs can be aborted. Mutations may already have reached the server, so
  // only supersede their application.
  state.controller?.abort();
  const { signal } = (state.controller = new AbortController());
  let response: Response | undefined;

  try {
    // Load the update entry before fetch so its compact possession echo can be
    // sent with the request. Cross-route template registration remains parallel
    // with the network.
    const entry = await target[2]();
    const have = encodeHave(entry.have?.() || "");
    const [fetched] = await Promise.all([
      fetch(href, {
        method: mutation && "POST",
        body: mutation?.[0],
        headers: {
          accept: patchAccept,
          "x-marko-route": "" + targetId,
          "x-marko-from": "" + state.currentId,
          "x-marko-build": state.buildHash,
          ...(have && { "x-marko-have": have }),
        },
        signal: mutation ? undefined : signal,
      }),
      targetId === state.currentId ? undefined : target[1](),
    ]);
    response = fetched;
    if (signal.aborted) return;

    // Status is intentionally not the discriminator: validation responses may
    // be non-2xx patches. A protocol/build/route mismatch returns non-patch
    // content and takes the ordinary-navigation fallback.
    if (!response.headers.get("content-type")?.includes(patchContentType)) {
      throw new Error(
        import.meta.env.DEV
          ? `unexpected update response (${response.status})`
          : String(response.status),
      );
    }

    const applyFrame = entry.createUpdate(entry.default);
    const parseFrame = getParseFrame();
    let applied = false;
    const applyLine = (line: string) => {
      if (!line) return;
      const fills: unknown[] = [];
      for (const item of parseFrame(line) as unknown[]) {
        if (
          typeof item === "function" ||
          typeof item === "string" ||
          Array.isArray(item)
        ) {
          fills.push(item);
        }
      }
      if (!fills.length) return;
      applyFrame(fills);
      if (!applied) {
        applied = true;
        state.currentId = targetId;
        const url = new URL(response!.url || href);
        const nextUrl = url.pathname + url.search;
        const samePage = nextUrl === state.appliedUrl;
        state.appliedUrl = nextUrl;
        if (push && !samePage) {
          history.pushState(null, "", url.href);
          scrollTo(0, 0);
        }
      }
    };

    // Each newline is one serializer frame. Apply synchronous HTML state as
    // soon as it arrives, then merge later async boundary frames in order.
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return;
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) applyLine(line);
      if (done) {
        applyLine(buffer);
        break;
      }
    }

    if (!applied) {
      throw new Error(
        import.meta.env.DEV ? "update response carried no fills" : undefined,
      );
    }
    dispatchEvent(new CustomEvent("marko-run:navigate"));
  } catch (err) {
    if (signal.aborted) return;
    fallback(err, href, push, mutation, response);
  }
}

// Possession echoes may contain arbitrary Unicode loop keys, while fetch
// headers must be byte-safe. Escape to ASCII and omit oversized hints; omission
// degrades only a diverging hop to the full-navigation fallback.
export function encodeHave(json: string): string {
  if (!json) return json;
  const escaped = json.replace(
    /[\u0080-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  return escaped.length > 4096 ? "" : escaped;
}

// Frames use the same resume-fill expressions as document scripts. Execute
// them through the same nonce-compatible script path used for page resumes.
let parseFrameImpl: undefined | ((line: string) => unknown[]);
function getParseFrame() {
  if (!parseFrameImpl) {
    const nonce =
      document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    parseFrameImpl = (line) => {
      const script = document.createElement("script");
      if (nonce) script.nonce = nonce;
      script.textContent = `self.__marko_run_frame__=(${line})`;
      document.head.appendChild(script).remove();
      const frame = (self as any).__marko_run_frame__ as unknown[];
      delete (self as any).__marko_run_frame__;
      return frame;
    };
  }
  return parseFrameImpl;
}
