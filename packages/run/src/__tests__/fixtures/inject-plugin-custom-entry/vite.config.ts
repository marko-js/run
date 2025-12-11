import marko from "@marko/run/vite";
import { defineConfig } from "vite";

import adapter from "./customAdapter";

export default defineConfig({
  plugins: [marko({ adapter: adapter() })],
  server: {
    hmr: false
  }
});
