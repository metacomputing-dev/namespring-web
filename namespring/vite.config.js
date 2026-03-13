import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ''),
  }
  const explicitBase = env.VITE_BASE_PATH
  const repoNameFromCi = env.GITHUB_REPOSITORY?.split('/')[1]
  const ciBase = repoNameFromCi ? `/${repoNameFromCi}/` : '/'
  const base = explicitBase || (env.GITHUB_ACTIONS ? ciBase : '/')
  const vercelProductionOrigin = 'https://namespring-web.vercel.app'
  const devApiProxyTarget = env.VITE_LOCAL_API_PROXY_TARGET || vercelProductionOrigin
  const devCrossOriginIsolationEnabled = String(env.VITE_DEV_ENABLE_CROSS_ORIGIN_ISOLATION || '').trim().toLowerCase() === 'true'
  const devIsolationHeaders = devCrossOriginIsolationEnabled
    ? {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    }
    : undefined

  return {
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
      proxy: {
        // Keep frontend calls same-origin and proxy /api during local dev.
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
      ...(devIsolationHeaders ? { headers: devIsolationHeaders } : {}),
    },
  }
})
