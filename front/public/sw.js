/**
 * Service Worker — 정적 에셋 영구 캐시 + 해시 기반 자동 갱신
 *
 * 전략:
 *   - GLB 모델, 텍스처 이미지 → Cache First (캐시 없으면 네트워크 → 저장)
 *   - /api/** → Network Only (게임 상태는 항상 서버에서)
 *   - CartoCDN 타일 → Cache First (지도 타일 오프라인 지원)
 *   - asset_manifest.json → 항상 네트워크 (버전 비교용)
 *
 * 갱신:
 *   앱 시작 시 /asset_manifest.json 을 서버에서 받아
 *   캐시된 버전과 해시 비교 → 달라진 파일만 re-fetch
 */

const CACHE_NAME = 'game-assets-v1';

const CACHEABLE_EXTENSIONS = ['.glb', '.png', '.jpg', '.jpeg', '.webp', '.json', '.hdr'];
const NETWORK_ONLY_PATTERNS = ['/api/', '/ws/', 'ws://', 'wss://'];
const SKIP_CACHE_PATHS = ['/asset_manifest.json'];

// ─── 설치: 즉시 활성화 ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch 가로채기 ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Network Only: API / WebSocket
  if (NETWORK_ONLY_PATTERNS.some((p) => request.url.includes(p))) return;

  // 2. manifest는 항상 네트워크 (비교용)
  if (SKIP_CACHE_PATHS.some((p) => url.pathname === p)) return;

  // 3. 캐시 대상 확장자인지 확인
  const ext = url.pathname.substring(url.pathname.lastIndexOf('.'));
  const isCacheable = CACHEABLE_EXTENSIONS.includes(ext);
  if (!isCacheable) return;

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network error', { status: 503 });
  }
}

// ─── 메시지: 매니페스트 기반 갱신 ────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_MANIFEST') {
    event.waitUntil(syncWithManifest(event.data.manifest));
  }
});

async function syncWithManifest(manifest) {
  const cache = await caches.open(CACHE_NAME);
  const staleManifest = await getStoredManifest(cache);

  const toFetch = [];
  for (const [path, hash] of Object.entries(manifest)) {
    if (staleManifest[path] !== hash) {
      toFetch.push(path);
    }
  }

  if (toFetch.length === 0) return;

  // 변경된 파일만 re-fetch
  await Promise.allSettled(
    toFetch.map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) {
          await cache.put(path, response);
        }
      } catch { /* 네트워크 오류는 다음 기회에 */ }
    })
  );

  // 업데이트된 manifest 저장
  await cache.put(
    '/__sw_manifest__',
    new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  // 삭제된 파일은 캐시에서 제거
  const currentPaths = new Set(Object.keys(manifest));
  const cachedKeys = await cache.keys();
  for (const req of cachedKeys) {
    const p = new URL(req.url).pathname;
    if (p.startsWith('/') && !currentPaths.has(p) && p !== '/__sw_manifest__') {
      await cache.delete(req);
    }
  }
}

async function getStoredManifest(cache) {
  try {
    const stored = await cache.match('/__sw_manifest__');
    if (!stored) return {};
    return await stored.json();
  } catch {
    return {};
  }
}
