import marko from "@marko/run/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // `patches` is not in the published types yet.
  plugins: [marko({ patches: true } as object)],
});
