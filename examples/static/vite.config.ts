import { defineConfig } from "vite";
import marko from "@marko/serve/vite";
import staticAdapter from "@marko/serve-adapter-static";

export default defineConfig({
  plugins: [marko({ adapter: staticAdapter() })]
});
