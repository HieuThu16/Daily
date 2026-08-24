import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { FORCE_RELOAD_FLAG } from './lib/appReload'
import 'leaflet/dist/leaflet.css'

// Lắng nghe khi Service Worker mới chiếm quyền điều khiển (claim clients) để làm mới mượt mà
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Đang bấm "Tải lại bản mới nhất": để hàm đó dọn cache xong rồi tự nạp lại.
    // Tải lại ở đây sẽ cắt ngang giữa chừng và app quay về đúng bản cũ.
    if (sessionStorage.getItem(FORCE_RELOAD_FLAG)) return
    const lastReload = sessionStorage.getItem('last_sw_reload')
    if (!lastReload || Date.now() - Number(lastReload) > 5000) {
      sessionStorage.setItem('last_sw_reload', Date.now().toString())
      window.location.reload()
    }
  })
}

// Sau khi bản mới đã nạp: bỏ cờ (5 giây để service worker mới kịp claim) và
// dọn ?_bust khỏi thanh địa chỉ cho sạch.
if (typeof window !== 'undefined') {
  if (sessionStorage.getItem(FORCE_RELOAD_FLAG)) {
    setTimeout(() => sessionStorage.removeItem(FORCE_RELOAD_FLAG), 5000)
  }
  if (window.location.search.includes('_bust=')) {
    const url = new URL(window.location.href)
    url.searchParams.delete('_bust')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
