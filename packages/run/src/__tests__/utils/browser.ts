import { type DOMWindow, JSDOM, VirtualConsole } from "jsdom";
import vm from "vm";
import { MessageChannel as NodeMessageChannel } from "worker_threads";

export interface GotoOptions {
  referer?: string;
  onBodyReady?: () => Promise<unknown> | unknown;
}

export class BrowserPage {
  declare window?: DOMWindow;
  declare response: Response;

  #ctx?: vm.Context;
  #modules = new Map<
    string,
    { module: Promise<vm.Module>; evaluated?: Promise<vm.Module> }
  >();
  #pendingModules = 0;
  #onModulesSettled: (() => void)[] = [];
  #pendingNavigation: Promise<unknown> = Promise.resolve();
  #seenAssets = new Set<string>();

  get document() {
    if (!this.window) throw new Error("The page has not loaded a document.");
    return this.window.document;
  }

  url() {
    return this.window ? this.window.location.href : this.response.url;
  }

  async goto(href: string, options: GotoOptions = {}) {
    await this.#navigate(
      href,
      { headers: options.referer ? { referer: options.referer } : {} },
      options.onBodyReady,
    );
  }

  fetch(href: string | URL, init?: RequestInit) {
    return fetch(new URL(href, this.url()), init);
  }

  async click(selector: string) {
    const el = this.document.querySelector(selector);
    if (!el) throw new Error(`No element matches ${JSON.stringify(selector)}`);
    (el as HTMLElement).click();
    await this.settle();
  }

  innerText(selector: string) {
    const el = this.document.querySelector(selector);
    if (!el) throw new Error(`No element matches ${JSON.stringify(selector)}`);
    return (el.textContent || "").trim();
  }

  async settle() {
    let nav;
    do {
      nav = this.#pendingNavigation;
      await nav;
    } while (nav !== this.#pendingNavigation);
    await this.#settleScheduled();
  }

  async #settleScheduled() {
    for (let i = 0; i < 3; i++) {
      await this.#modulesSettled();
      await this.#animationFrame();
      await new Promise((resolve) => setTimeout(resolve));
      await new Promise(setImmediate);
    }
  }

  async close() {
    await this.#pendingNavigation.catch(() => {});
    this.window?.close();
    this.window = undefined;
  }

  async #navigate(
    href: string,
    init: RequestInit & { headers: Record<string, string> },
    onBodyReady?: GotoOptions["onBodyReady"],
  ) {
    const response = await fetch(href, {
      ...init,
      headers: {
        accept: "text/html,*/*;q=0.8",
        ...init.headers,
      },
    });

    this.response = response;

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("text/html")) {
      this.window?.close();
      this.window = undefined;
      return;
    }

    await this.#loadDocument(response, onBodyReady);
  }

  async #loadDocument(
    response: Response,
    onBodyReady?: GotoOptions["onBodyReady"],
  ) {
    this.window?.close();
    this.#modules = new Map();
    this.#pendingModules = 0;
    this.#seenAssets = new Set();

    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", () => {});

    const dom = new JSDOM("", {
      url: response.url,
      runScripts: "dangerously",
      pretendToBeVisual: true,
      virtualConsole,
    });
    const { window } = dom;
    this.window = window;
    this.#ctx = dom.getInternalVMContext();
    this.#setupWindow(window);

    const { document } = window;
    const chunks = await readChunks(response);

    let bodyReady = false;
    const captureInitial = async () => {
      if (!bodyReady && document.body) {
        bodyReady = true;
        await this.#runModuleScripts(window);
        await onBodyReady?.();
      }
    };

    document.open();
    if (chunks.length > 1) {
      const writeNextChunk = streamWriter(document, chunks);
      while (writeNextChunk()) {
        await captureInitial();
        await new Promise(setImmediate);
        if (window !== this.window) return;
      }
    } else {
      document.write(chunks[0] || "");
      document.close();
    }

    const refresh = document
      .querySelector('meta[http-equiv="refresh" i]')
      ?.getAttribute("content");
    const refreshUrl = refresh && /url\s*=\s*(.+)\s*$/i.exec(refresh)?.[1];
    if (refreshUrl) {
      await this.#navigate(
        new URL(refreshUrl, response.url).href,
        { headers: { referer: response.url } },
        onBodyReady,
      );
      return;
    }

    await this.#runModuleScripts(window);
    await captureInitial();
    await this.#checkAssets(window);
    await this.#settleScheduled();
  }

  #setupWindow(window: DOMWindow) {
    window.setImmediate ||= setImmediate;
    window.MessageChannel ||= NodeMessageChannel as any;
    window.fetch ||= ((input: any, init?: RequestInit) =>
      fetch(
        typeof input === "string" || input instanceof URL
          ? new URL(input, window.location.href)
          : input,
        init,
      )) as any;
    for (const key of [
      "Headers",
      "Request",
      "Response",
      "ReadableStream",
      "TextDecoder",
      "TextEncoder",
    ] as const) {
      window[key] ||= globalThis[key] as any;
    }

    window.addEventListener("error", (ev) => {
      this.#reportError(
        `${ev.error || `Error loading ${(ev.target as any)?.outerHTML}`}\n`,
      );
    });

    window.addEventListener("submit", (ev) => {
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      const submitter = (ev as SubmitEvent).submitter;
      this.#queueNavigation(() => this.#submitForm(form, submitter));
    });
    window.addEventListener("click", (ev) => {
      if (ev.defaultPrevented) return;
      const anchor = (ev.target as Element).closest?.("a[href]");
      if (anchor) {
        ev.preventDefault();
        this.#queueNavigation(() =>
          this.#navigate((anchor as HTMLAnchorElement).href, {
            headers: { referer: this.url() },
          }),
        );
      }
    });
  }

  #queueNavigation(nav: () => Promise<unknown>) {
    this.#pendingNavigation = this.#pendingNavigation.then(nav, nav);
  }

  async #submitForm(form: HTMLFormElement, submitter?: HTMLElement | null) {
    const window = this.window!;
    let data: FormData;
    try {
      data = new window.FormData(form, submitter || undefined) as FormData;
    } catch {
      data = new window.FormData(form) as FormData;
    }

    const method = (
      (submitter?.getAttribute("formmethod") || form.method || "get") as string
    ).toLowerCase();
    const url = new URL(
      submitter?.getAttribute("formaction") ||
        form.getAttribute("action") ||
        "",
      window.location.href,
    );
    const referer = this.url();

    if (method === "get") {
      url.search = new URLSearchParams(data as any).toString();
      await this.#navigate(url.href, { headers: { referer } });
    } else {
      const body =
        form.enctype === "multipart/form-data"
          ? data
          : new URLSearchParams(data as any);
      await this.#navigate(url.href, {
        method,
        body,
        headers: { referer },
      });
    }
  }

  async #runModuleScripts(window: DOMWindow) {
    for (const script of [...window.document.querySelectorAll("script")]) {
      if (window !== this.window) return;
      if (script.type !== "module") continue;
      if (script.src) {
        await this.#importModule(script.src).catch((err) =>
          this.#reportError(`${err}\n`),
        );
      } else if (script.text) {
        await this.#runInlineModule(
          script.text,
          `${window.location.href}#inline`,
        ).catch((err) => this.#reportError(`${err}\n`));
      }
    }
    await this.#modulesSettled();
  }

  #getModule(href: string, referrer?: string): Promise<vm.Module> {
    const url = new URL(href, referrer ?? this.url()).href;
    let entry = this.#modules.get(url);
    if (!entry) {
      this.#pendingModules++;
      entry = {
        module: (new URL(url).pathname === "/@vite/client"
          ? this.#viteClientStub(url)
          : fetch(url).then(async (res) => {
              if (!res.ok) {
                throw new Error(`Failed to load module ${url} (${res.status})`);
              }
              return this.#createModule(await res.text(), url);
            })
        ).finally(() => this.#moduleDone()),
      };
      this.#modules.set(url, entry);
    }
    return entry.module;
  }

  #importModule(href: string, referrer?: string): Promise<vm.Module> {
    const url = new URL(href, referrer ?? this.url()).href;
    this.#getModule(url);
    const entry = this.#modules.get(url)!;
    return (entry.evaluated ||= (async () => {
      this.#pendingModules++;
      try {
        const mod = await entry.module;
        if (mod.status === "unlinked") {
          await mod.link(this.#linker);
        }
        await mod.evaluate();
        return mod;
      } finally {
        this.#moduleDone();
      }
    })());
  }

  async #runInlineModule(source: string, identifier: string) {
    this.#pendingModules++;
    try {
      const mod = this.#createModule(source, identifier);
      await mod.link(this.#linker);
      await mod.evaluate();
    } finally {
      this.#moduleDone();
    }
  }

  #linker = (specifier: string, referrer: vm.Module) =>
    this.#getModule(specifier, referrer.identifier);

  #createModule(source: string, identifier: string) {
    return new vm.SourceTextModule(source, {
      context: this.#ctx,
      identifier,
      initializeImportMeta(meta) {
        meta.url = identifier;
      },
      importModuleDynamically: ((specifier: string, referrer: vm.Module) =>
        this.#importModule(specifier, referrer.identifier)) as any,
    });
  }

  #moduleDone() {
    if (!--this.#pendingModules) {
      const resolvers = this.#onModulesSettled;
      this.#onModulesSettled = [];
      for (const resolve of resolvers) resolve();
    }
  }

  async #viteClientStub(url: string) {
    const { window } = this;
    let ErrorOverlay = window!.customElements.get("vite-error-overlay");
    if (!ErrorOverlay) {
      ErrorOverlay = class extends window!.HTMLElement {};
      window!.customElements.define("vite-error-overlay", ErrorOverlay);
    }
    const mod = new vm.SyntheticModule(
      [
        "createHotContext",
        "updateStyle",
        "removeStyle",
        "injectQuery",
        "ErrorOverlay",
      ],
      function (this: vm.SyntheticModule) {
        this.setExport("createHotContext", () => ({
          accept() {},
          acceptExports() {},
          dispose() {},
          prune() {},
          on() {},
          off() {},
          send() {},
          invalidate() {},
        }));
        this.setExport("updateStyle", () => {});
        this.setExport("removeStyle", () => {});
        this.setExport("injectQuery", (url: string) => url);
        this.setExport("ErrorOverlay", ErrorOverlay);
      },
      { context: this.#ctx, identifier: url },
    );
    await mod.link(() => {
      throw new Error("Unexpected import in vite client stub");
    });
    await mod.evaluate();
    return mod;
  }

  #modulesSettled() {
    if (this.#pendingModules) {
      return new Promise<void>((resolve) =>
        this.#onModulesSettled.push(resolve),
      );
    }
  }

  async #checkAssets(window: DOMWindow) {
    const checks: Promise<void>[] = [];
    for (const el of window.document.querySelectorAll<
      HTMLScriptElement | HTMLLinkElement
    >("script[src],link[rel=stylesheet][href]")) {
      const href = "src" in el ? el.src : el.href;
      if (!href || this.#seenAssets.has(href) || !/^https?:/.test(href)) {
        continue;
      }
      this.#seenAssets.add(href);
      checks.push(
        (async () => {
          try {
            const res = await fetch(href);
            await res.arrayBuffer();
            if (!res.ok) throw new Error();
          } catch {
            this.#reportError(`Error loading ${el.outerHTML}\n`);
          }
        })(),
      );
    }
    await Promise.all(checks);
  }

  #animationFrame() {
    const { window } = this;
    if (!window) return;
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  #reportError(msg: string) {
    const document = this.window?.document;
    if (!document || msg.includes("WebSocket closed")) return;
    let errorContainer = document.getElementById("error");
    if (!errorContainer) {
      errorContainer = document.createElement("pre");
      errorContainer.id = "error";
      (document.getElementById("app") || document.body).appendChild(
        errorContainer,
      );
    }
    errorContainer.insertAdjacentText("beforeend", msg);
  }
}

async function readChunks(response: Response) {
  const chunks: string[] = [];
  if (response.body) {
    const decoder = new TextDecoder();
    let pending = "";
    for await (const raw of response.body) {
      pending += decoder.decode(raw, { stream: true });
      if (pending.endsWith(">")) {
        chunks.push(pending);
        pending = "";
      }
    }
    pending += decoder.decode();
    if (pending) chunks.push(pending);
  }
  return chunks;
}

function streamWriter(document: Document, chunks: string[]) {
  const FLUSH = "%%FLUSH%%";
  const parsed = document.implementation.createHTMLDocument();
  parsed.write(chunks.join(`<!--${FLUSH}-->`));
  parsed.doctype?.remove();

  const walker = parsed.createTreeWalker(parsed);
  const targetNodes = new WeakMap<Node, Node>([[parsed, document]]);
  let node: Node | null;

  return () => {
    while ((node = walker.nextNode())) {
      if (node.nodeType === 8 && (node as Comment).data === FLUSH) {
        return true;
      }

      const isInline = isInlineScript(node);
      const clone = document.importNode(node, isInline);
      targetNodes.set(node, clone);
      (targetNodes.get(node.parentNode!) as ParentNode).appendChild(clone);

      if (isInline && node.firstChild) {
        walker.nextNode();
      }
    }
    document.close();
    return false;
  };
}

function isInlineScript(node: Node): node is HTMLScriptElement {
  return (
    (node as HTMLScriptElement).tagName === "SCRIPT" &&
    (node as HTMLScriptElement).type !== "module" &&
    !(node as HTMLScriptElement).src
  );
}
