import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/splitsbilla/', // served from a GitHub Pages project page, not the domain root
  plugins: [react()],
})
