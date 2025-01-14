import { getDevGlobal } from "@marko/run/adapter";
import net from "net";
import { createServer } from "vite";

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
  if (config.plugins) {
    const plugin = await import("@marko/run/vite");
    config.plugins = plugin.default();
  }

  globalThis.__marko_run_vite_config__ = config;

  let changed = false;
  const loader = await createServer({
    ...config,
    ssr: { external: ["@marko/run/router"] },
  });

  const port = await getAvailablePort();
  await loader.listen(port);

  loader.ssrLoadModule(entry).catch((err) => {
    loader.ssrFixStacktrace(err);

    console.error(err);

    const devGlobal = getDevGlobal();
    for (const devServer of devGlobal.devServers) {
      const { message, stack = "" } = err;
      devServer.ws.send(
        JSON.stringify({
          type: "error",
          err: { message, stack },
        }),
      );
    }
  });

  loader.watcher.on("change", (path) => {
    if (!changed && loader.moduleGraph.getModulesByFile(path)) {
      changed = true;
      process.send("restart");
    }
  });
}

function shutdown() {
  const devGlobal = getDevGlobal();
  for (const devServer of devGlobal.devServers) {
    devServer.ws.send({ type: "full-reload" });
  }
  devGlobal.clear();
}

async function getAvailablePort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
