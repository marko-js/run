import { buildIdHeader, patchContentType } from "../vite/constants";
import { href } from "./url-builder";

(window as any).Run ||= {
  href,
};

type ApplyPatch = (frame: string) => boolean;

const buildId: string = (globalThis as any).__MARKO_RUN_BUILD_ID__ || "dev";

// Every navigation gets an epoch; a response that arrives after a later one
// started is dropped rather than applied out of order.
let epoch = 0;

if (typeof document !== "undefined" && getApplyPatch()) {
  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPopState);
}

// Only a persisted build exposes an applier; without one there is nothing to
// intercept and the browser keeps doing ordinary document navigation.
function getApplyPatch(): ApplyPatch | undefined {
  return (window as any).__marko_apply_patch__;
}

function onClick(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const anchor = (event.target as Element | null)?.closest?.("a");
  const url = anchor && patchableUrl(anchor as HTMLAnchorElement);
  if (!url) return;

  event.preventDefault();
  navigate(url, "push");
}

function onPopState() {
  navigate(new URL(location.href), "replace");
}

function patchableUrl(anchor: HTMLAnchorElement) {
  if (
    anchor.target ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("rel")?.includes("external")
  ) {
    return;
  }

  const attr = anchor.getAttribute("href");
  if (!attr || attr.startsWith("#")) return;

  const url = new URL(anchor.href);
  return url.origin === location.origin ? url : undefined;
}

async function navigate(url: URL, mode: "push" | "replace") {
  const started = ++epoch;
  let frames: string[];

  try {
    const response = await fetch(url, {
      headers: { accept: patchContentType, [buildIdHeader]: buildId },
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith(patchContentType)
    ) {
      return fallback(url);
    }

    frames = (await response.text()).split("\n").filter(Boolean);
  } catch {
    return fallback(url);
  }

  // A superseded navigation must not touch the document it no longer describes.
  if (started !== epoch) return;

  const applyPatch = getApplyPatch()!;
  for (const frame of frames) {
    if (!applyPatch(frame)) return fallback(url);
  }

  history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

function fallback(url: URL) {
  location.assign(url);
}
