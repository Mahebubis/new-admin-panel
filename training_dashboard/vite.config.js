import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
    strictPort: true,
    // Proxy /api to the live host so the browser sees ONE origin during dev,
    // exactly as it does in production. Calling the API directly from
    // localhost makes the session cookie third-party, and Chrome withholds
    // those on XHR — you log in, then every following request is a 401.
    proxy: {
      '/api': {
        target: 'https://training.internshipstudio.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // hls.js is only reached for .m3u8 lessons, so it stays in its own chunk
    // and never costs anything on a course of plain MP4s.
    chunkSizeWarningLimit: 900,
  },
})
