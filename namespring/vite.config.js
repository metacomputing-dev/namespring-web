import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'path'

const namingEvidenceRunsRoot = path.resolve(
  __dirname,
  '../lib/spring-ts/data/naming-report/evidence/generation/runs',
)
const combinedReportPreviewPath = path.resolve(
  __dirname,
  '../lib/spring-ts/artifacts/phase10-agent-a3/after-samples/02-choi-seongsoo-tiered-fortune.json',
)

function namingEvidencePilotViewerPlugin() {
  return {
    name: 'namespring-naming-evidence-pilot-viewer',
    configureServer(server) {
      server.middlewares.use('/__dev/combined-report-preview', (_request, response) => {
        try {
          const fixture = JSON.parse(fs.readFileSync(combinedReportPreviewPath, 'utf8'))
          const fortuneReport = fixture.payload
          const selectedCandidate = {
            fullHangul: '최성수',
            fullHanja: '崔成秀',
            finalScore: 76,
            scoreVector: {
              sajuFit: 68,
              phonetic: 84,
              familyFit: 81,
            },
          }
          const shareUserInfo = {
            lastName: [{ hangul: '최', hanja: '崔' }],
            firstName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
          }
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify({ fortuneReport, selectedCandidate, shareUserInfo }))
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
        }
      })
      server.middlewares.use('/__dev/naming-evidence', (request, response) => {
        try {
          const requestUrl = new URL(request.url || '/', 'http://localhost')
          const requestedRun = requestUrl.searchParams.get('run')
          const runs = fs.existsSync(namingEvidenceRunsRoot)
            ? fs.readdirSync(namingEvidenceRunsRoot, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && /^[a-zA-Z0-9._-]+$/u.test(entry.name))
              .map((entry) => {
                const runDir = path.join(namingEvidenceRunsRoot, entry.name)
                const draftPath = path.join(runDir, 'naming-evidence.generated-draft.json')
                const samplesDir = path.join(runDir, 'samples')
                if (!fs.existsSync(draftPath) || !fs.existsSync(samplesDir)) return null
                const sampleFiles = fs.readdirSync(samplesDir).filter((file) => /^sample-\d+-.+\.json$/u.test(file))
                if (sampleFiles.length === 0) return null
                return {
                  name: entry.name,
                  updatedAt: fs.statSync(draftPath).mtime.toISOString(),
                  sampleCount: sampleFiles.length,
                  draftPath,
                  samplesDir,
                  sampleFiles,
                }
              })
              .filter(Boolean)
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            : []
          const selected = runs.find(({ name }) => name === requestedRun) || runs[0] || null
          const payload = selected
            ? {
              runs: runs.map(({ name, updatedAt, sampleCount }) => ({ name, updatedAt, sampleCount })),
              selectedRun: selected.name,
              samples: selected.sampleFiles
                .sort((left, right) => left.localeCompare(right))
                .map((file) => JSON.parse(fs.readFileSync(path.join(selected.samplesDir, file), 'utf8'))),
              draft: JSON.parse(fs.readFileSync(selected.draftPath, 'utf8')),
            }
            : { runs: [], selectedRun: null, samples: [], draft: null }
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify(payload))
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
        }
      })
    },
  }
}

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
    plugins: [react(), namingEvidencePilotViewerPlugin()],
    resolve: {
      alias: {
        '@seed': path.resolve(__dirname, '../lib/seed-ts/src'),
        '@spring': path.resolve(__dirname, '../lib/spring-ts/src'),
        '@saju': path.resolve(__dirname, '../lib/saju-ts/src'),
        'sql.js': path.resolve(__dirname, 'node_modules/sql.js'),
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
