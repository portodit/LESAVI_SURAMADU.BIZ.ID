import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const root = "/home/ivalora/LESAVI-SURAMADU/apps/dashboard";

export default defineConfig({
  root: root,
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": root + "/src" } },
  build: { outDir: root + "/dist/public", emptyOutDir: true },
});
