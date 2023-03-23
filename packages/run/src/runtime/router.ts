import type { RuntimeModule } from "./types";

function fromRuntime<T extends 'fetch' | 'match' | 'invoke'>(name: T): RuntimeModule[T] {
  return (...args: any[]) => {
    const runtime = globalThis.__marko_run__;
    if (!runtime) {
      throw new Error(
        "This should have been replaced by the @marko/run plugin at build/dev time"
      );
    }
    return (runtime[name] as any)(...args)
  }
}

export const fetch = fromRuntime('fetch');
export const match = fromRuntime('match');
export const invoke = fromRuntime('invoke');
