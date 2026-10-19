import { getDevGlobal, resolveAdapter } from "@marko/run/adapter";
import plugin, { defaultConfigPlugin } from "@marko/run/vite";
import net from "net";
import path from "path";
import { createServer, normalizePath, resolveConfig } from "vite";

let loader;

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
  if (config.plugins?.length) {
    const resolvedConfig = await resolveConfig(
      {
        root: config.root,
        configFile: config.configFile,
        logLevel: "silent",
        plugins: [defaultConfigPlugin],
      },
      "serve",
    );
    const adapter = await resolveAdapter(resolvedConfig);
    const plugins =
      (adapter.plugins &&
        (await adapter.plugins({
          root: config.root,
          command: "dev",
          entry,
        }))) ||
      [];

    if (config.plugins.some((plugin) => plugin.name === "marko-run-vite:pre")) {
      plugins.push(...plugin());
    }

    config.plugins = plugins;
  }

  globalThis.__marko_run_vite_config__ = config;

  loader = await createServer({
    ...config,
    plugins: [
      ...(config.plugins || []),
      restartOnEntryChange(path.resolve(config.root, entry)),
    ],
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
}

async function shutdown() {
  const devGlobal = getDevGlobal();
  for (const devServer of devGlobal.devServers) {
    devServer.ws.send({ type: "full-reload" });
  }
  devGlobal.clear();
  await loader?.close();
}

/**
 * Asks for a fresh worker when the entry, a module it imports, or the Vite
 * config changes. A plugin so the watcher survives Vite's own server restarts.
 */
function restartOnEntryChange(entryFile) {
  const entryId = normalizePath(entryFile);
  let requested = false;
  return {
    name: "marko-run:dev-entry-restart",
    configureServer(server) {
      server.watcher.on("change", (changedFile) => {
        const file = normalizePath(changedFile);
        if (
          !requested &&
          process.connected &&
          (isConfigFile(server.config, file) ||
            importsFile(server.moduleGraph, entryId, file))
        ) {
          requested = true;
          process.send("restart");
        }
      });
    },
  };
}

function isConfigFile(config, file) {
  return (
    file === config.configFile || config.configFileDependencies.includes(file)
  );
}

function importsFile(moduleGraph, entryId, file) {
  const queue = [...(moduleGraph.getModulesByFile(file) || [])];
  const seen = new Set(queue);
  for (const mod of queue) {
    if (mod.file === entryId) {
      return true;
    }
    for (const importer of mod.importers) {
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
    }
  }
  return false;
}

async function getAvailablePort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
