import baseAdapter from '@marko/serve/adapter';
import type { Adapter } from '@marko/serve/adapter';

export default function(): Adapter {
  return {
    ...baseAdapter(),
    name: 'node-adapter'
  }
};