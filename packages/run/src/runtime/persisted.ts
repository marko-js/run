/// <reference types="vite/client" />
// Eager navigation bootstrap. The engine and route table ship with the
// entry: enhanced navigation is core progressive enhancement, so the first
// click pays only for the route's update modules and the patch — never for
// interception machinery. Route update graphs stay lazy per route.

import {
  type Mutation,
  navigate,
  type NavigationState,
  type RouteMatcher,
} from "./persisted-navigation.js";

const state: NavigationState = {
  appliedUrl: "",
  buildId: "",
  currentId: 0,
};
let matcher: RouteMatcher;

export function register(
  routeMatcher: RouteMatcher,
  // The build-stable index of the route this page rendered through.
  id: number,
  // The link-assets build id baked into both bundles as a literal; the
  // server only honors patch requests from its own build.
  buildId: string,
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
  matcher = routeMatcher;
  state.currentId = id;
  state.buildId = buildId;
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

function navigateMatched(
  href: string,
  push: boolean,
  pathname: string,
  mutation?: Mutation,
) {
  try {
    const target = matcher(pathname);
    if (target) {
      navigate(state, href, push, target, mutation, fallback);
    } else {
      fallbackNative(href, push, mutation);
    }
  } catch (err) {
    fallback(err, href, push, mutation);
  }
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
