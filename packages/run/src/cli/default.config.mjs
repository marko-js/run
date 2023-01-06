import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import staticAdapter from "@marko/run/adapter";

export default defineConfig({
  plugins: [marko({ adapter: staticAdapter() })],
});
