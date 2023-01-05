import { defineConfig } from "vite";
import marko from "@marko/serve/vite";
import nodeAdapter from "@marko/serve-adapter-node";

export default defineConfig({
  plugins: [marko({ adapter: nodeAdapter() })]
});
