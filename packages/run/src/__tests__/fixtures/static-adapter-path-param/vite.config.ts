import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-static";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: adapter({ urls: ["/users/456"] }) })],
});
