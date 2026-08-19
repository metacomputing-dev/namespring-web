import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted webfonts. tokens.css only names these families; these imports
// register them. Pretendard ships as "Pretendard Variable" (weights 45-920,
// per-block dynamic subsets); Noto Serif KR stays on the display weights.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@fontsource/noto-serif-kr/korean-600.css'
import '@fontsource/noto-serif-kr/korean-700.css'
import '@fontsource/noto-serif-kr/latin-600.css'
import '@fontsource/noto-serif-kr/latin-700.css'
import './index.css'
import 'react-day-picker/dist/style.css'
import AppRouter from './AppRouter'
import { getCanonicalRedirectUrl } from './lib/canonical'
import { initTheme } from './theme/theme-mode'

initTheme()

const canonicalRedirectUrl = getCanonicalRedirectUrl()
if (canonicalRedirectUrl) {
  window.location.replace(canonicalRedirectUrl)
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  )
}
