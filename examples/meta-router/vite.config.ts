import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import nodeAdapter from "@marko/run-adapter-node";
import { generateRoutesJson } from "./src/config";

export default defineConfig({
  plugins: [
    marko({
      adapter: nodeAdapter(),
      emitRoutes: generateRoutesJson
    }),
  ]
});
