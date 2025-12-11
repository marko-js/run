import marko, { getApi } from "@marko/run/vite";
import adapter from "@marko/run-adapter-node";
import path from 'path';
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: adapter() }), {
    name: 'external-routes',
    enforce: 'pre',
    configResolved(config) {
      const api = getApi(config);
      api.addExternalRoutes({
        name: 'custom',
        routes: [{
          path: '/',
          entryFile: path.join(process.cwd(), 'src', 'other-routes', 'page.marko'),
          templates: [],
          verbs: ['*']
        }]
      })
    }
  }],
  server: {
    hmr: false
  }
});
