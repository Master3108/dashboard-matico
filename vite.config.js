import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      '/webhook': {
        target: 'https://n8n-n8n.cwf1hb.easypanel.host',
        changeOrigin: true,
        secure: true
      },
      '/webhook-test': {
        target: 'https://n8n-n8n.cwf1hb.easypanel.host',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
