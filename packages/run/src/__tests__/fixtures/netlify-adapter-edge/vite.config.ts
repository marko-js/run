import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-netlify";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: adapter({ edge: true }) })],
  server: {
    hmr: false
  }
});
