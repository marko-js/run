import type { RuntimeModule } from "./types";

// In dev, app code imports these instead of the generated router, which would
// import that code back through its routes; each call reaches the real router.
export const fetch = fromRuntime("fetch");
export const invoke = fromRuntime("invoke");
export const match: RuntimeModule["match"] = (method, pathname) =>
  getRuntime().match(method, pathname);

function fromRuntime<T extends "fetch" | "invoke">(name: T): RuntimeModule[T] {
  return ((...args: any[]) => {
    const runtime = globalThis.__marko_run__;
    return runtime
      ? (runtime[name] as any)(...args)
      : loadRuntime().then((runtime) => (runtime[name] as any)(...args));
  }) as RuntimeModule[T];
}

// A runtime the dev entry never ran in (an adapter's worker) loads the router on
// first use; the app has evaluated by then, so this cannot recreate the cycle.
async function loadRuntime() {
  await import("@marko/run/router");
  return getRuntime();
}

function getRuntime() {
  const runtime = globalThis.__marko_run__;
  if (!runtime) {
    throw new Error(
      "This should have been replaced by the @marko/run plugin at build/dev time",
    );
  }
  return runtime;
}
