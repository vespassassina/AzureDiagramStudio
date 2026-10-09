import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const favicon = document.createElement('link')
favicon.rel = 'icon'
favicon.href = 'data:,'
document.head.append(favicon)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
