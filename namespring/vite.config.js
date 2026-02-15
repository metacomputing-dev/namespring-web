import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@spring': path.resolve(__dirname, '../lib/spring-ts/src'),
      '@name': path.resolve(__dirname, '../lib/name-ts/src')
    }
  },
  server: {
    // Required for SQLite WASM (SharedArrayBuffer support)
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
})