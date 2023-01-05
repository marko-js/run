import type { Options } from '../types';

const KEY = "__MARKO_SERVE_OPTIONS__"
export function getMarkoServeOptions<T extends Record<string, any>>(viteConfig: T): Readonly<Options> | undefined {
  return (viteConfig as any)[KEY];
}
export function setMarkoServeOptions<T extends Record<string, any>>(viteConfig: T, options: Options): T {
  (viteConfig as any)[KEY] = options;
  return viteConfig;
}
