import marko from "@marko/run/vite";
import netlifyAdapter from "@marko/run-adapter-netlify";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: netlifyAdapter({ edge: true }) })],
});
