/**
 * useSeoulDongs.js
 * 서울 425개 동 행정 경계 데이터를 패치하고 로컬 캐시 관리.
 * 현재 GPS 좌표 기반 '동' 판별 기능 제공.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import worldApi from '@api/world';

const CACHE_NAME = 'seoul-dongs-v1';
const CACHE_URL = '/api/seoul-dongs-full'; // 가상의 캐시 키

/** Ray-casting PIP */
function pointInPolygon(lat, lng, polygon) {
  const n = polygon.length;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if ((yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function useSeoulDongs() {
  const [dongs, setDongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const dongsRef = useRef([]);

  useEffect(() => {
    const loadDongs = async () => {
      // 1. Cache API 확인
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedRes = await cache.match(CACHE_URL);
        if (cachedRes) {
          const data = await cachedRes.json();
          if (data?.dongs?.length > 0) {
            setDongs(data.dongs);
            dongsRef.current = data.dongs;
            return;
          }
        }
      } catch (_) { }

      // 2. 서버 패치
      setLoading(true);
      try {
        const response = await worldApi.getDongs();
        const data = response.data;
        const list = data.dongs || [];
        setDongs(list);
        dongsRef.current = list;

        // 캐시 저장
        try {
          const cache = await caches.open(CACHE_NAME);
          cache.put(CACHE_URL, new Response(JSON.stringify(data)));
        } catch (_) { }
      } catch (e) {
        console.error('[useSeoulDongs] 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDongs();
  }, []);

  const getDongAt = useCallback((lat, lng) => {
    // [성능 최적화] 실제로는 BBox 체크를 먼저 해야 하지만, 브라우저 성능 상 400개는 직접 순회 가능
    for (const dong of dongsRef.current) {
      if (pointInPolygon(lat, lng, dong.coords)) {
        return dong;
      }
    }
    return null;
  }, []);

  return { dongs, loading, getDongAt };
}
