import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-netlify";

export default defineConfig({
  plugins: [marko({ adapter: adapter({ edge: true }) })],
});
