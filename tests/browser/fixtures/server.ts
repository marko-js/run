import { createServer } from "node:http";

import { build } from "esbuild";

export async function serve() {
  const js = (
    await build({
      entryPoints: [new URL("./client.ts", import.meta.url).pathname],
      bundle: true,
      write: false,
      format: "esm",
      target: "es2022",
    })
  ).outputFiles[0].text;
  const requests: {
    method: string;
    path: string;
    patch: boolean;
    body: string;
  }[] = [];
  const gates = new Map<string, () => void>();
  function release(name: string) {
    gates.get(name)?.();
    gates.delete(name);
  }
  function wait(name: string) {
    return new Promise<void>((resolve) => gates.set(name, resolve));
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://test");
    if (url.pathname === "/client.js") {
      res.writeHead(200, { "content-type": "text/javascript" }).end(js);
      return;
    }
    const patch = url.searchParams.has("~");
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method!, path: url.pathname, patch, body });
    const name = url.pathname.slice(3);
    if (!patch) {
      res
        .writeHead(200, { "content-type": "text/html" })
        .end(documentPage(name === "stale" ? "stale-native" : name));
    } else if (name === "redirect") {
      res.writeHead(302, { location: "/r/b?~" }).end();
    } else if (name === "nocontent") {
      res.writeHead(204).end();
    } else if (name === "stale") {
      res.writeHead(412).end();
    } else if (name === "notpatch") {
      res
        .writeHead(200, { "content-type": "text/html" })
        .end(documentPage(name));
    } else {
      res.writeHead(200, { "x-marko-patch": "browser-test" });
      if (name === "late") await wait("first");
      if (res.destroyed) return;
      res.write(`<p id="first">${name}</p>\n`);
      if (name === "slow" || name === "late") await wait("end");
      if (res.destroyed) return;
      res.end(
        `<div style="height:2500px"></div><p id="target" tabindex="-1">end ${name}</p><div style="height:1500px"></div>\n`,
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    release,
    async close() {
      for (const name of gates.keys()) release(name);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function documentPage(name: string) {
  return `<!doctype html><title>doc ${name}</title><body>
    <nav>${["a", "b", "slow", "late", "long", "redirect", "nocontent", "notpatch"].map((id) => `<a id="${id}" href="/r/${id}">${id}</a>`).join(" ")}
    <a id="fragment" href="#top">fragment</a><a id="section" href="/r/long#target">section</a>
    </nav><form id="get" action="/r/search"><input name="q" value="x y"><button id="getb">get</button></form>
    <form id="post" method="post" action="/r/post"><input name="v" value="1&2"><button id="postb" name="btn" value="yes">post</button></form>
    <form id="stale" method="post" action="/r/stale"><input name="v" value="s"><button id="staleb">stale</button></form>
    <main><p id="top">${name}</p><div style="height:4000px"></div></main><script type="module" src="/client.js"></script>`;
}
