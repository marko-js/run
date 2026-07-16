/// <reference types="vite/client" />
// Eager interception shell; navigation code remains lazy until first use.

import type {
  Mutation,
  NavigationState,
  RouteMatcher,
} from "./persisted-navigation.js";

const state: NavigationState = {
  appliedUrl: "",
  buildId: "",
  currentId: 0,
  have: "",
};
let matcher: RouteMatcher | undefined;
let matcherPromise: Promise<RouteMatcher> | undefined;
let loadMatcher: () => Promise<RouteMatcher>;
let getHave: () => string | undefined;
let haveRead: boolean | undefined;

export function register(
  loadMatch: () => Promise<RouteMatcher>,
  // The build-stable index of the route this page rendered through.
  id: number,
  // The link-assets build id baked into both bundles as a literal; the
  // server only honors patch requests from its own build.
  buildId: string,
  // Reads the token under whichever key Marko's own mode wrote it.
  have: () => string | undefined,
) {
  if (!matcher) {
    state.appliedUrl = location.pathname + location.search;
    // Patched traversals restore scroll themselves once applied; the
    // browser's automatic restore would fire against the pre-patch DOM.
    history.scrollRestoration = "manual";
    addEventListener("click", onClick);
    addEventListener("submit", onSubmit);
    addEventListener("popstate", onPopstate);
  }
  loadMatcher = loadMatch;
  state.currentId = id;
  state.buildId = buildId;
  getHave = have;
}

function onClick(ev: MouseEvent) {
  if (
    ev.defaultPrevented ||
    ev.button ||
    ev.metaKey ||
    ev.ctrlKey ||
    ev.shiftKey ||
    ev.altKey
  ) {
    return;
  }

  const link = (ev.target as Element).closest?.("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.origin !== location.origin ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download") ||
    link.relList.contains("external")
  ) {
    return;
  }

  // Same-document fragment movement stays native; an empty fragment (`#`)
  // has no `hash` yet still scrolls natively rather than refetching.
  if (
    (link.hash || link.href.includes("#")) &&
    link.pathname === location.pathname &&
    link.search === location.search
  ) {
    return;
  }

  ev.preventDefault();
  navigateMatched(link.href, true, link.pathname);
}

// Forms retain native behavior when they cannot use the patch path.
function onSubmit(ev: SubmitEvent) {
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const method = (
    submitter?.getAttribute("formmethod") || getFormAttr(form, "method")
  )?.toLowerCase();
  if (
    ev.defaultPrevented ||
    state.resubmitting ||
    (method !== "get" && method !== "post")
  ) {
    return;
  }

  const url = new URL(
    submitter?.getAttribute("formaction") ??
      getFormAttr(form, "action") ??
      location.href,
    location.href,
  );
  const formTarget =
    submitter?.getAttribute("formtarget") || getFormAttr(form, "target");
  if (
    url.origin !== location.origin ||
    (formTarget && formTarget !== "_self")
  ) {
    return;
  }

  // POSTs can patch the current route or renegotiate after a redirect.
  const data = new FormData(form, submitter);
  if (method === "get") {
    const params = new URLSearchParams();
    for (const [name, value] of data) {
      params.append(name, typeof value === "string" ? value : value.name);
    }
    url.search = params.toString();
    ev.preventDefault();
    navigateMatched(url.href, true, url.pathname);
  } else {
    const enctype = (
      submitter?.getAttribute("formenctype") || getFormAttr(form, "enctype")
    )?.toLowerCase();
    if (enctype === "text/plain") return;
    let body: FormData | URLSearchParams = data;
    if (enctype !== "multipart/form-data") {
      body = new URLSearchParams();
      for (const [name, value] of data) {
        body.append(name, typeof value === "string" ? value : value.name);
      }
    }
    ev.preventDefault();
    // A repeat submit during an in-flight mutation keeps native double-submit
    // semantics: both POSTs may commit; only the newest response applies.
    navigateMatched(url.href, true, location.pathname, [body, form, submitter]);
  }
}

function getFormAttr(form: HTMLFormElement, name: string) {
  return form.getAttribute(name) || (name === "method" ? "get" : undefined);
}

function onPopstate() {
  const url = location.pathname + location.search;
  if (url === state.appliedUrl) return;
  navigateMatched(location.href, false, location.pathname);
}

let navigationModule:
  | Promise<typeof import("./persisted-navigation.js")>
  | undefined;

function navigateMatched(
  href: string,
  push: boolean,
  pathname: string,
  mutation?: Mutation,
) {
  // The initial document's token is read exactly once; afterward patches own
  // `state.have`, including its canonical explicit-empty replacement.
  if (!haveRead) {
    try {
      state.have = getHave() || "";
      haveRead = true;
    } catch (err) {
      // The event is already prevented; a broken accessor (e.g. a missing
      // runtime global) must still navigate rather than strand the click.
      return fallback(err, href, push, mutation);
    }
  }
  Promise.all([
    matcher
      ? matcher(pathname)
      : (matcherPromise ||= loadMatcher().then(
          (loaded) => (matcher = loaded),
        )).then((loaded) => loaded(pathname)),
    (navigationModule ||= import("./persisted-navigation.js")),
  ]).then(
    ([target, { navigate }]) =>
      target
        ? navigate(state, href, push, target, mutation, fallback)
        : fallbackNative(href, push, mutation),
    (err) => fallback(err, href, push, mutation),
  );
}

function fallbackNative(href: string, push: boolean, mutation?: Mutation) {
  if (mutation) {
    state.resubmitting = true;
    try {
      mutation[1].requestSubmit(mutation[2]);
    } finally {
      state.resubmitting = false;
    }
  } else if (push) {
    location.assign(href);
  } else {
    location.reload();
  }
}

function fallback(
  err: unknown,
  href: string,
  push: boolean,
  mutation?: Mutation,
  response?: Response,
) {
  // Before a response, native resubmission accepts normal duplicate-POST risk.
  // After one, follow the server-owned final URL with GET.
  if (mutation) {
    if (response) {
      if (import.meta.env.DEV && !response.redirected) {
        console.warn(
          "@marko/run: a mutation response outside the patch protocol (stale build, or a direct response from a route other than the current page) cannot be shown; its body is dropped and the final URL is loaded with GET.",
        );
      }
      location.assign(response.url || href);
    } else {
      fallbackNative(href, push, mutation);
    }
  } else if (push) {
    location.assign(href);
  } else {
    location.reload();
  }
  console.warn("@marko/run: persisted navigation fell back", err);
}
