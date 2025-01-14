import type { AdapterConfig, Options } from "../types";

const PluginConfigKey = "__MARKO_RUN_PLUGIN_CONFIG__";
const AdapterConfigKey = "__MARKO_RUN_ADAPTER_CONFIG__";

function getConfig<T>(obj: any, key: string): Readonly<T> | undefined {
  return obj[key] as T;
}
function setConfig<T, U>(obj: U, key: string, value: T): U {
  (obj as any)[key] = value;
  return obj;
}

export const getExternalPluginOptions = <T>(viteConfig: T) =>
  getConfig<Options>(viteConfig, PluginConfigKey);
export const setExternalPluginOptions = <T>(viteConfig: T, value: Options) =>
  setConfig(viteConfig, PluginConfigKey, value);

export const getExternalAdapterOptions = <T>(viteConfig: T) =>
  getConfig<AdapterConfig>(viteConfig, AdapterConfigKey);
export const setExternalAdapterOptions = <T>(
  viteConfig: T,
  value: AdapterConfig,
) => setConfig(viteConfig, AdapterConfigKey, value);
