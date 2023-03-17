import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-node";

export default defineConfig({
  plugins: [marko({ adapter: adapter() })],
});
