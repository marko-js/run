import { mergeConfig } from "vite";
import baseAdapter, { type Adapter } from "@marko/run/adapter";
export type { NodePlatformInfo } from "@marko/run/adapter";

export default function (): Adapter {
  const base = baseAdapter();
  return {
    ...base,
    name: "node-adapter",
    async viteConfig(config) {
      const baseConfig = await base.viteConfig?.(config);
      const adapterConfig = {
        ssr: {
          noExternal: /@marko\/run-adapter-node/
        }
      }
      return baseConfig ? mergeConfig(baseConfig, adapterConfig) : adapterConfig;
    },
    typeInfo(writer) {
      writer(`import type { NodePlatformInfo } from '@marko/run-adapter-node'`);
      return "NodePlatformInfo";
    },
  };
}
