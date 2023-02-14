import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import nodeAdapter from "@marko/run-adapter-node";

import { generateRoutesJson } from "./src/ebay-stuff";

export default defineConfig({
  plugins: [
    marko({
      adapter: nodeAdapter(),
      emitRoutes: generateRoutesJson
    }),
  ],
  // ssr: {
  //   noExternal: [
  //     'makeup-prevent-scroll-keys',
  //     'makeup-navigation-emitter',
  //     'makeup-roving-tabindex',
  //     'makeup-exit-emitter',
  //     'makeup-next-id',
  //     'makeup-typeahead'
  //   ]
  // }
});
