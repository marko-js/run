import { createServer } from "vite";

let getDevGlobal;

process
  .on("message", (message) => {
    switch (message.type) {
      case "start":
        return start(message.entry, message.config);
      case "shutdown":
        return shutdown();
    }
  })
  .send("ready");

async function start(entry, config) {
  globalThis.__marko_run_vite_config__ = config;
  let changed = false;
  const loader = await createServer({ ...config, ssr: { external: ['@marko/run/router'] }});
  ({ getDevGlobal } = await import("@marko/run/adapter"));
  await loader.ssrLoadModule(entry);

  loader.watcher.on("change", (path) => {
    if (!changed && loader.moduleGraph.getModulesByFile(path)) {
      changed = true;
      process.send("restart");
    }
  });
}

function shutdown() {
  if (getDevGlobal) {
    const devGlobal = getDevGlobal();
    for (const devServer of devGlobal.devServers) {
      devServer.ws.send({ type: "full-reload" });
    }
    devGlobal.clear();
  }
}
