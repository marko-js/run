import { defineConfig } from "vite";

// Scanning for dependencies would also report both templates, in no set order.
export default defineConfig({
  optimizeDeps: { noDiscovery: true },
  server: { hmr: false },
});
