import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Installed app picks up new deploys on next launch without asking
registerSW({ immediate: true })

// The old image cache mixed plain and CORS loads of the same picture, which broke covers. Drop it.
if ('caches' in window) caches.delete('covers').catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
