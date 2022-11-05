import { defineConfig } from "vite";
import marko from "@marko/serve/vite";

export default defineConfig({
  plugins: [marko()],
  build: {
    sourcemap: true, // Generate sourcemaps for all builds.
    emptyOutDir: false, // Avoid server & client deleting files from each other.
  },
  optimizeDeps: {
    exclude: ['@marko/serve']
  },
  // define: {
  //   'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  // }
});
