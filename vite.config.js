import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Google Maps key is browser-restricted and intentionally exposed.
  envPrefix: ['VITE_', 'GOOGLE_MAPS_API_KEY'],
})
