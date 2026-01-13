import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";

// Vite + CRXJS will read the manifest and handle content scripts automatically
import manifest from "./src/manifest.json";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "src/css"),
  plugins: [
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/scripts"),
      "@types": resolve(__dirname, "src/types"),
      "@/types": resolve(__dirname, "src/types"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html"),
        settings: resolve(__dirname, "src/settings.html"),
      },
    },
    // Chrome extension needs to work without ES module support in older browsers
    target: "esnext",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
      },
    },
  },
  // Development server configuration
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
