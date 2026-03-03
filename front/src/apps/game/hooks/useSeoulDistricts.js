/**
 * useSeoulDistricts.js
 * 서울 25개 구 경계 데이터를 한 번만 패치하고 브라우저 캐시에 저장.
 * 이후 호출은 캐시에서 즉시 반환. (구 경계 폴리곤 + 현재 구 판별 함수 제공)
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_KEY = 'seoul-districts-cache-v2';
const CACHE_TTL = 86400000 * 30; // 30일 (행정 경계는 거의 불변)

/** Ray-casting PIP: GPS 점이 폴리곤 안에 있으면 true */
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

export function useSeoulDistricts() {
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const districtsRef = useRef([]);  // 최신 districts를 ref로도 보관 (콜백에서 stale closure 방지)

  useEffect(() => {
    const loadDistricts = async () => {
      // 1. 브라우저 로컬 캐시 확인
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data } = JSON.parse(cached);
          if (data?.districts?.length > 0) {
            console.log(`[useSeoulDistricts] 로컬 캐시 사용 (${data.districts.length}개 구)`);
            setDistricts(data.districts);
            districtsRef.current = data.districts;
            return;
          }
        }
      } catch (_) { }

      // 2. 백엔드 API 패치
      setLoading(true);
      try {
        const res = await fetch('/api/game/districts');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = data.districts || [];
        console.log(`[useSeoulDistricts] 서버에서 ${list.length}개 구 경계 로드`);
        setDistricts(list);
        districtsRef.current = list;

        // 로컬 캐시 저장
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
        } catch (_) { }
      } catch (e) {
        console.error('[useSeoulDistricts] 로드 실패:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadDistricts();
  }, []);

  /**
   * 주어진 GPS 좌표가 어느 구에 속하는지 반환.
   * 해당하는 구 객체 반환, 없으면 null.
   */
  const getDistrictAt = useCallback((lat, lng) => {
    for (const district of districtsRef.current) {
      if (pointInPolygon(lat, lng, district.coords)) {
        return district;
      }
    }
    return null;
  }, []);

  return { districts, loading, error, getDistrictAt };
}
