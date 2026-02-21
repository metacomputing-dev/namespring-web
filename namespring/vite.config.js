import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const explicitBase = process.env.VITE_BASE_PATH
const repoNameFromCi = process.env.GITHUB_REPOSITORY?.split('/')[1]
const ciBase = repoNameFromCi ? `/${repoNameFromCi}/` : '/'
const base = explicitBase || (process.env.GITHUB_ACTIONS ? ciBase : '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@seed': path.resolve(__dirname, '../lib/seed-ts/src'),
      '@spring': path.resolve(__dirname, '../lib/spring-ts/src'),
      '@saju': path.resolve(__dirname, '../lib/saju-ts/src'),
      'fflate': path.resolve(__dirname, 'node_modules/fflate/esm/browser.js'),
    }
  },
  optimizeDeps: {
    exclude: ['react-day-picker'],
  },
  server: {
    fs: {
      // Allow loading workspace sibling packages in dev (e.g. ../lib/saju-ts/src).
      allow: [path.resolve(__dirname, '..')],
    },
    // Required for SQLite WASM (SharedArrayBuffer support)
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
})
