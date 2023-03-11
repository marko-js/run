import baseAdapter, { type Adapter } from "@marko/run/adapter";
export type { NodePlatformInfo } from "@marko/run/adapter";

export default function (): Adapter {
  return {
    ...baseAdapter(),
    name: "node-adapter",
    typeInfo(writer) {
      writer(`import type { NodePlatformInfo } from '@marko/run-adapter-node'`);
      return "NodePlatformInfo";
    },
  };
}
