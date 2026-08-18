import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
