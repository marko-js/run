import { defineConfig } from "vite";

export default defineConfig({
  define: { CONFIG_VALUE: JSON.stringify("before") },
  server: { hmr: false },
});
