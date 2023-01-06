import baseAdapter from '@marko/run/adapter';
import type { Adapter } from '@marko/run/adapter';

export default function(): Adapter {
  return {
    ...baseAdapter(),
    name: 'node-adapter'
  }
};