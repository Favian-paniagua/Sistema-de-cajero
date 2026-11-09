import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" permite publicar la carpeta dist en cualquier hosting (GitHub Pages, Netlify, Vercel…)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
