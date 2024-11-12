import { t } from 'marko/src/runtime/html/index.js';
import _marko_to_string from 'marko/src/runtime/helpers/to-string.js';
import { x } from 'marko/src/runtime/html/helpers/escape-xml.js';
import _initComponents from 'marko/src/core-tags/components/init-components-tag.js';
import _marko_tag from 'marko/src/runtime/helpers/render-tag.js';
import _awaitReorderer from 'marko/src/core-tags/core/await/reorderer-renderer.js';
import _preferredScriptLocation from 'marko/src/core-tags/components/preferred-script-location-tag.js';
import _marko_renderer from 'marko/src/runtime/components/renderer.js';
import _marko_dynamic_tag from 'marko/src/runtime/helpers/dynamic-tag.js';
import _flush_here_and_after__ from 'marko/src/core-tags/core/__flush_here_and_after__.js';

var pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" }
};
function pageResponse(template, input) {
  return new Response(template.stream(input), pageResponseInit);
}
var NotHandled = Symbol();
var NotMatched = Symbol();
globalThis.MarkoRun ?? (globalThis.MarkoRun = {
  NotHandled,
  NotMatched,
  route(handler) {
    return handler;
  }
});
var serializedGlobals = { params: true, url: true };
function createContext(route, request, platform, url = new URL(request.url)) {
  const context = route ? {
    request,
    url,
    platform,
    meta: route.meta,
    params: route.params,
    route: route.path,
    serializedGlobals
  } : {
    request,
    url,
    platform,
    meta: {},
    params: {},
    route: "",
    serializedGlobals
  };
  let input;
  return [
    context,
    (data) => {
      input ?? (input = {
        $global: context
      });
      return data ? Object.assign(input, data) : input;
    }
  ];
}

const _marko_componentType$2 = "src/__tests__/fixtures/static-adapter-path-param/src/routes/users.$id+page.marko",
  _marko_template$2 = t(_marko_componentType$2);
const _marko_component$2 = {};
_marko_template$2._ = _marko_renderer(function (input, out, _componentDef, _component, state, $global) {
  out.w("<!doctype html>");
  out.w("<html lang=en>");
  out.w("<head>");
  out.w(_marko_to_string(out.global.___viteRenderAssets("head-prepend")));
  out.w("<meta charset=UTF-8>");
  out.w("<title>");
  out.w("@marko/run Test Fixture");
  out.w("</title>");
  out.w(_marko_to_string(out.global.___viteRenderAssets("head")));
  out.w("</head>");
  out.w("<body>");
  out.w(_marko_to_string(out.global.___viteRenderAssets("body-prepend")));
  out.w("<div id=app>");
  out.w("<nav>");
  out.w("<a href=/users/123>");
  out.w("User 123");
  out.w("</a>");
  out.w("<a href=/users/456>");
  out.w("User 456");
  out.w("</a>");
  out.w("</nav>");
  out.w("<h1>");
  out.w("User ");
  out.w(x($global.params.id));
  out.w("</h1>");
  out.w("</div>");
  out.w(_marko_to_string(out.global.___viteRenderAssets("body")));
  _marko_tag(_initComponents, {}, out, _componentDef, "10");
  _marko_tag(_awaitReorderer, {}, out, _componentDef, "11");
  _marko_tag(_preferredScriptLocation, {}, out, _componentDef, "12");
  out.w("</body>");
  out.w("</html>");
}, {
  t: _marko_componentType$2,
  i: true,
  d: true
}, _marko_component$2);

const _marko_componentType$1 = "src/__tests__/fixtures/static-adapter-path-param/__marko-run__route.users.$id.marko",
  _marko_template$1 = t(_marko_componentType$1);
const _marko_component$1 = {};
_marko_template$1._ = _marko_renderer(function (input, out, _componentDef, _component, state, $global) {
  _marko_dynamic_tag(out, _marko_template$2, () => input, null, null, null, _componentDef, "0");
}, {
  t: _marko_componentType$1,
  i: true,
  d: true
}, _marko_component$1);

const base = "/";
function addAssets(g, newEntries) {
  const entries = g.___viteEntries;
  if (entries) {
    g.___viteEntries = entries.concat(newEntries);
    return true;
  }
  g.___viteEntries = newEntries;
  g.___viteRenderAssets = renderAssets;
  g.___viteInjectAttrs = g.cspNonce ? ` nonce="${g.cspNonce.replace(/"/g, "&#39;")}"` : "";
  g.___viteSeenIds = /* @__PURE__ */ new Set();
}
function renderAssets(slot) {
  const entries = this.___viteEntries;
  let html = "";
  if (entries) {
    const seenIds = this.___viteSeenIds;
    const slotWrittenEntriesKey = `___viteWrittenEntries-${slot}`;
    const lastWrittenEntry = this[slotWrittenEntriesKey] || 0;
    const writtenEntries = this[slotWrittenEntriesKey] = entries.length;
    if (!this.___flushedMBP && slot !== "head-prepend") {
      this.___flushedMBP = true;
      html += `<script${this.___viteInjectAttrs}>$mbp=${JSON.stringify(base)}</script>`;
    }
    for (let i = lastWrittenEntry; i < writtenEntries; i++) {
      let entry = entries[i];
      if (typeof entry === "string") {
        entry = __MARKO_MANIFEST__[entry] || {};
      }
      const parts = entry[slot];
      if (parts) {
        for (let i2 = 0; i2 < parts.length; i2++) {
          const part = parts[i2];
          switch (part) {
            case 0:
              html += this.___viteInjectAttrs;
              break;
            case 1:
              html += base;
              break;
            case 2: {
              const id = parts[++i2];
              const skipParts = parts[++i2];
              if (seenIds.has(id)) {
                i2 += skipParts;
              } else {
                seenIds.add(id);
              }
              break;
            }
            default:
              html += part;
              break;
          }
        }
      }
    }
  }
  return html;
}

const _marko_componentType = "src/__tests__/fixtures/static-adapter-path-param/__marko-run__route.users.$id.entry.marko",
  _marko_template = t(_marko_componentType);
const _marko_component = {};
_marko_template._ = _marko_renderer(function (input, out, _componentDef, _component, state, $global) {
  const g = out.global;
  const writeSync = addAssets(g, ["__marko-run__route_BF71"]);
  if (writeSync) {
    out.w(_marko_to_string(g.___viteRenderAssets("head-prepend") + g.___viteRenderAssets("head") + g.___viteRenderAssets("body-prepend")));
  } else {
    _marko_tag(_flush_here_and_after__, {
      "renderBody": out => {
        out.w(_marko_to_string(g.___viteRenderAssets("head-prepend") + g.___viteRenderAssets("head") + g.___viteRenderAssets("body-prepend")));
      }
    }, out, _componentDef, "0");
  }
  _marko_tag(_marko_template$1, input, out, _componentDef, "1");
  _marko_tag(_initComponents, {}, out, _componentDef, "2");
  _marko_tag(_awaitReorderer, {}, out, _componentDef, "3");
  if (writeSync) {
    out.w(_marko_to_string(g.___viteRenderAssets("body")));
  } else {
    _marko_tag(_flush_here_and_after__, {
      "renderBody": out => {
        out.w(_marko_to_string(g.___viteRenderAssets("body")));
      }
    }, out, _componentDef, "4");
  }
}, {
  t: _marko_componentType,
  i: true,
  d: true
}, _marko_component);

// virtual:marko-run/__marko-run__route.users.$id.js

async function get1(context, buildInput) {
	return pageResponse(_marko_template, buildInput());
}

globalThis.__marko_run__ = { match, fetch, invoke };
function match(method, pathname) {
  if (!pathname) {
    pathname = "/";
  } else if (pathname.charAt(0) !== "/") {
    pathname = "/" + pathname;
  }
  switch (method) {
    case "GET":
    case "get": {
      const len = pathname.length;
      if (len > 1) {
        const i1 = pathname.indexOf("/", 1) + 1;
        if (i1 && i1 !== len) {
          if (pathname.slice(1, i1 - 1) === "users") {
            const i2 = pathname.indexOf("/", 7) + 1;
            if (!i2 || i2 === len) {
              const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
              if (s2) return { handler: get1, params: { id: s2 }, meta: {}, path: "/users/:id" };
            }
          }
        }
      }
      return null;
    }
  }
  return null;
}
async function invoke(route, request, platform, url) {
  const [context, buildInput] = createContext(route, request, platform, url);
  if (route) {
    try {
      const response = await route.handler(context, buildInput);
      if (response) return response;
    } catch (error) {
      if (error === NotHandled) return;
      if (error !== NotMatched) throw error;
    }
  }
}
async function fetch(request, platform) {
  try {
    const url = new URL(request.url);
    let { pathname } = url;
    if (pathname !== "/" && !pathname.endsWith("/")) {
      url.pathname = pathname + "/";
      return Response.redirect(url);
    }
    const route = match(request.method, pathname);
    return await invoke(route, request, platform, url);
  } catch (error) {
    {
      throw error;
    }
  }
}

export { fetch };
;var __MARKO_MANIFEST__={"__marko-run__route_BF71":{"head-prepend":null,"head":null,"body-prepend":null,"body":null}};
