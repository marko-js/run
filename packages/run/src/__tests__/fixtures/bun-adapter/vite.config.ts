import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-bun";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko({ adapter: adapter() })],
  server: {
    hmr: false,
  },
});
