import { useState, useEffect } from 'react';

/**
 * 텍스처 폴더 목록을 API에서 가져와 관리하는 훅
 * @param {Function} apiFn - 폴더 목록을 반환하는 API 함수
 * @param {string} currentFolder - 현재 선택된 폴더
 * @param {Function} setCurrentFolder - 현재 폴더 setter
 * @returns {{ availableFolders: string[] }}
 */
export function useTextureFolders(apiFn, currentFolder, setCurrentFolder) {
  const [availableFolders, setAvailableFolders] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchFolders = async () => {
      try {
        const res = await apiFn();
        const folders = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        setAvailableFolders(folders);
        if (currentFolder && !folders.includes(currentFolder)) {
          setCurrentFolder('');
        }
      } catch (_) {
        if (!cancelled) setAvailableFolders([]);
      }
    };

    fetchFolders();
    return () => { cancelled = true; };
  }, [currentFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  return { availableFolders };
}
