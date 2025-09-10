import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        // Détection automatique
        target: process.env.DOCKER_ENV
          ? "http://nginx:80" // Docker: via nginx
          : "http://localhost:3001", // Local: direct
        changeOrigin: true,
      },
    },
  },
});
