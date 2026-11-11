import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // En producción la web se sirve como estáticos (`npm run start` → serve -s dist).
  // `vite preview` queda solo para pruebas locales, sin abrir allowedHosts.
  preview: {
    host: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
