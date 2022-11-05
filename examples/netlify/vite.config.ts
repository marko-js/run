import { defineConfig } from "vite";
import marko from "@marko/serve/vite";
import netlify from '@marko/serve-netlify'

export default defineConfig({
  plugins: [
    marko({ adapter: netlify() }),
  ],
  build: {
    sourcemap: true, // Generate sourcemaps for all builds.
    emptyOutDir: false, // Avoid server & client deleting files from each other.
  }
});
