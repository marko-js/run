import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-node";

export default defineConfig({
  server: {
    port: 12345
  },
  preview: {
    port: 23456
  }
});
