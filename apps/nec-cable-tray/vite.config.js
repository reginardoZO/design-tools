import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" keeps asset URLs relative so the app works from any sub-path of
// the GitHub Pages site (https://<user>.github.io/<repo>/apps/nec-cable-tray/).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
