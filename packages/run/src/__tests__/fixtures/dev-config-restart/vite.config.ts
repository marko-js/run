import marko from "@marko/run/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marko()],
  define: { __CONFIG_LABEL__: JSON.stringify("one") },
  server: {
    hmr: false,
  },
});
