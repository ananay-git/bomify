import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname!, "./src"),
    },
  },
  server: {
    port: 5173,
    host:true,
    // In Docker, VITE_API_PROXY_TARGET=http://api:8000
    // Locally (npm run dev), falls back to http://localhost:8000
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
}));
