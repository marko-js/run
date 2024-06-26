import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-static";

export default defineConfig({
  plugins: [marko({ adapter: adapter({ urls: ["/foo"] }) })],
});
