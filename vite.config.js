import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "../app/static",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/testSetup.js"
  }
});
