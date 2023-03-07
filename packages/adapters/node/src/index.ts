import baseAdapter, { type Adapter } from "@marko/run/adapter";

export type { NodePlatformInfo } from "@marko/run/adapter";

export default function (): Adapter {
  return {
    ...baseAdapter(),
    name: "node-adapter",
    writeTypeInfo() {
      return `import type { NodePlatformInfo } from '@marko/run-adapter-node';

declare module '@marko/run' {
  interface ContextExtensions {
    platform: NodePlatformInfo
  }
}`;
    },
  };
}
