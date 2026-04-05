// 게임 환경설정 훅 — localStorage 즉시 저장 + 로그인 유저 DB 동기화
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import gameApi from '@api/game';

const STORAGE_KEY = 'game_settings_v1';

export const DEFAULT_SETTINGS = {
  // 전투
  autoFarmRange: 60,
  autoAttackRange: 30,
  // UI 표시
  showStatPanel: true,
  showMinimap: true,
  showChat: true,
  showJoystick: true,
  showItemNotif: true,
  showRegionTitle: true,
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveLocal(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export const useGameSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(loadLocal);
  const dbSyncedRef = useRef(false);

  // 로그인 유저: 최초 1회 DB에서 로드 (DB > localStorage > 기본값)
  useEffect(() => {
    if (!user?.id || dbSyncedRef.current) return;
    dbSyncedRef.current = true;
    gameApi.getSettings(user.id)
      .then(res => {
        const dbSettings = res.data?.settings;
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          const merged = { ...DEFAULT_SETTINGS, ...dbSettings };
          setSettings(merged);
          saveLocal(merged);
        }
      })
      .catch(() => {}); // DB 실패 시 localStorage 유지
  }, [user?.id]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveLocal(next);
      return next;
    });
  }, []);

  // DB 저장 (명시적 저장 버튼 또는 자동)
  const saveToDb = useCallback(async (overrides = {}) => {
    setSettings(prev => {
      const next = { ...prev, ...overrides };
      saveLocal(next);
      if (user?.id) {
        gameApi.saveSettings(user.id, next).catch(() => {});
      }
      return next;
    });
  }, [user?.id]);

  const resetSettings = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSettings({ ...DEFAULT_SETTINGS });
    if (user?.id) {
      gameApi.saveSettings(user.id, DEFAULT_SETTINGS).catch(() => {});
    }
  }, [user?.id]);

  return { settings, updateSetting, saveToDb, resetSettings };
};
