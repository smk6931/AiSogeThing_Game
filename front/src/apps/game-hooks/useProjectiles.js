import { useState, useCallback } from 'react';

/**
 * [투사체 데이터 바구니]
 * 여기선 복잡한 계산 안 하고, 데이터만 넣고 빼고 업데이트합니다.
 */
export const useProjectiles = () => {
  const [projectiles, setProjectiles] = useState([]);

  // 1. 발사체 추가
  const add = useCallback((data) => {
    setProjectiles(prev => [...prev, {
      id: crypto.randomUUID(),
      ...data,
      generation: data.generation || 0
    }]);
  }, []);

  // 2. 발사체 정보 업데이트 (주로 회전할 때 사용)
  const update = useCallback((id, data) => {
    setProjectiles(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  // 3. 발사체 제거
  const remove = useCallback((id) => {
    setProjectiles(prev => prev.filter(p => p.id !== id));
  }, []);

  return { projectiles, add, update, remove };
};
