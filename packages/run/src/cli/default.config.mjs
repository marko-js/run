import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import nodeAdapter from "@marko/run/adapter";

export default defineConfig({
  plugins: [marko({ adapter: nodeAdapter() })]
});
