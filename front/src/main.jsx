import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ─── Service Worker 등록 + 매니페스트 기반 캐시 갱신 ──────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // SW가 활성화된 후 manifest 비교
    const sw = reg.active || reg.installing || reg.waiting;
    if (!sw) return;

    const onActive = async () => {
      try {
        const res = await fetch('/asset_manifest.json', { cache: 'no-store' });
        if (!res.ok) return;
        const manifest = await res.json();
        sw.postMessage({ type: 'CHECK_MANIFEST', manifest });
      } catch { /* manifest 없으면 스킵 */ }
    };

    if (reg.active) {
      onActive();
    } else {
      sw.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') onActive();
      });
    }
  } catch (err) {
    console.error('[SW] 등록 실패:', err);
  }
}

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
