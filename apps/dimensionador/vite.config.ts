import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: "./" keeps asset URLs relative so the app works from any sub-path of
// the GitHub Pages site (https://<user>.github.io/<repo>/dimensionador/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
