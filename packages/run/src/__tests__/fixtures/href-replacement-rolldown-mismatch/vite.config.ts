import type { Plugin } from "vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [foreignVite()],
  build: {
    rolldownOptions: {
      experimental: { nativeMagicString: true },
    },
  },
  server: {
    hmr: false,
  },
});

/**
 * Builds as another install of the same Vite version would: `@marko/run` sees
 * an environment that is not its `BuildEnvironment` but its own Rolldown
 * version, and a returned `code` that is not a string is dropped, since that
 * install's Rolldown fails the `instanceof` check on a magic string.
 */
function foreignVite(): Plugin {
  return {
    name: "test:foreign-vite",
    configResolved(config) {
      const pre = config.plugins.find(
        (plugin) => plugin.name === "marko-run-vite:pre",
      );
      const post = config.plugins.find(
        (plugin) => plugin.name === "marko-run-vite:post",
      );
      if (!pre || !post) {
        return;
      }

      const buildStart = pre.buildStart as (
        this: unknown,
        ...args: unknown[]
      ) => Promise<void>;
      (pre as Plugin).buildStart = function (this: object, ...args: unknown[]) {
        return buildStart.apply(foreignContext(this), args);
      } as Plugin["buildStart"];

      const transform = post.transform as (
        this: unknown,
        ...args: unknown[]
      ) => Promise<{ code?: unknown } | null | undefined>;
      (post as Plugin).transform = async function (
        this: unknown,
        ...args: unknown[]
      ) {
        const result = await transform.apply(this, args);
        return result && typeof result.code !== "string" ? null : result;
      } as Plugin["transform"];
    },
  };
}

function foreignContext<T extends object>(context: T): T {
  const environment = new Proxy(
    (context as { environment: object }).environment,
    {
      get: (target, key) => Reflect.get(target, key, target),
      getPrototypeOf: () => Object.prototype,
    },
  );
  return new Proxy(context, {
    get(target, key) {
      if (key === "environment") {
        return environment;
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
