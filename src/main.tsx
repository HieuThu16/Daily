import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import 'leaflet/dist/leaflet.css'

// Lắng nghe khi Service Worker mới chiếm quyền điều khiển (claim clients) để làm mới mượt mà
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const lastReload = sessionStorage.getItem('last_sw_reload')
    if (!lastReload || Date.now() - Number(lastReload) > 5000) {
      sessionStorage.setItem('last_sw_reload', Date.now().toString())
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
