import { defineConfig } from "vite";
import marko from "@marko/serve/vite";
import netlifyAdapter from "@marko/serve-adapter-netlify";

export default defineConfig({
  plugins: [marko({ adapter: netlifyAdapter({ edge: true }) })],
});
