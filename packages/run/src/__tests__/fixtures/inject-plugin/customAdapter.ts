import baseAdapter, { type Adapter } from '@marko/run/adapter';
import { Plugin } from 'vite';

const customPlugin: Plugin = {
  name: 'custom-adapter-plugin',
  enforce: 'pre',
  resolveId(importee) {
    if (importee === 'custom-module') {
      return importee;
    }
  },
  load(id) {
    if (id === 'custom-module') {
      return 'export default () => "From Custom Module"';
    }
  },
}

export default (): Adapter => {
  return {
    ...baseAdapter(),
    name: 'custom-adapter',
    plugins() {
      return [customPlugin]
    }
  }
}