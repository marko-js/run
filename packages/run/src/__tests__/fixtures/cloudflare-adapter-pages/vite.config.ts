import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-cloudflare";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: adapter({ mode: "pages" }) })],
  server: {
    hmr: false,
  },
});
