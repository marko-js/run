import { defineConfig } from "vite";
import marko from "@marko/serve/vite";

import ebayStuff from "./src/ebay-stuff";

export default defineConfig({
  plugins: [
    marko(ebayStuff),
  ],
  build: {
    sourcemap: true, // Generate sourcemaps for all builds.
    emptyOutDir: false, // Avoid server & client deleting files from each other.
    // commonjsOptions: {
    //   transformMixedEsModules: true,
    // },
  },
  optimizeDeps: {
    //include: ['@ebay/ebayui-core']
  },
  ssr: {
    noExternal: [
      'makeup-prevent-scroll-keys',
      'makeup-navigation-emitter',
      'makeup-roving-tabindex',
      'makeup-exit-emitter',
      'makeup-next-id',
      'makeup-typeahead'
    ]
  }
});
