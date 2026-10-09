import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps every URL relative, so the same build works at
// seepidemiologia.es/inJS/, on GitHub Pages or in any other folder.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
