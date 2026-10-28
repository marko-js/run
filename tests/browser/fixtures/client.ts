import { router } from "../../../packages/run/src/runtime/patch";

declare global {
  interface Window {
    navigation: EventTarget & {
      transition: object | null;
      currentEntry: { key: string };
      traverseTo(key: string): unknown;
      navigate(url: string): unknown;
    };
    /** The app's listener that runs before the router's. */
    appFirst?: (event: Event) => void;
    pauseFrame?: boolean;
    releaseFrame?: () => void;
    events: { type: string; url: string; replay?: boolean }[];
  }
}
const events: Window["events"] = [];
window.events = events;
let stopCurrent: (() => void) | undefined;
function record(type: string, replay?: boolean) {
  events.push({ type, url: location.pathname + location.search, replay });
}

function patch(signal: AbortSignal, replay?: unknown) {
  record("request", !!replay);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const stop = () => {
    if (stopCurrent === stop) {
      stopCurrent = undefined;
      reader?.cancel().catch(() => {});
      record("stop");
    }
  };
  stopCurrent?.();
  stopCurrent = stop;
  signal.addEventListener("abort", stop);
  async function apply(
    response: Response,
    onCommit: () => void,
    onApplied: () => void,
    onEnd: () => void,
    onFail: () => void,
  ) {
    function fail() {
      if (stopCurrent === stop) {
        stop();
        onFail();
      }
    }
    if (stopCurrent !== stop || !response.headers.has("x-marko-patch")) {
      response.body?.cancel();
      return fail();
    }
    reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let partial = "",
      first = true;
    try {
      for (let read; !(read = await reader.read()).done;) {
        const frames = (
          partial + decoder.decode(read.value, { stream: true })
        ).split("\n");
        partial = frames.pop()!;
        for (const frame of frames) {
          if (window.pauseFrame) {
            window.pauseFrame = false;
            events.push({ type: "held", url: new URL(response.url).pathname });
            await new Promise<void>(
              (resolve) => (window.releaseFrame = resolve),
            );
            events.push({
              type: "released",
              url: new URL(response.url).pathname,
            });
          }
          if (stopCurrent !== stop) {
            events.push({
              type: "discard",
              url: new URL(response.url).pathname,
            });
            return;
          }
          if (first) {
            // As marko's apply: the caller commits its history before the first frame.
            onCommit();
            first = false;
            document.querySelector("main")!.innerHTML = "";
            document.title = "patched";
            record("commit");
          }
          document
            .querySelector("main")!
            .insertAdjacentHTML("beforeend", frame);
          record("frame");
          onApplied();
        }
      }
    } catch {
      return fail();
    }
    if (stopCurrent === stop) {
      record("end");
      onEnd();
    }
  }
  return [{ "x-marko-patch": "browser-test" }, apply] as const;
}
router(patch, /^\/r\//);
record("ready");
