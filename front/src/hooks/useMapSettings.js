import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import worldApi from '@api/world';
import gameApi from '@api/game';
import { useTextureFolders } from './useTextureFolders';

// ─── 카메라 localStorage 키 ────────────────────────────────────────────────
const CAMERA_STORAGE_KEYS = {
  zoomLevel: 'game_camera_zoom_level',
  cameraMode: 'game_camera_mode',
};

const DEFAULT_ZOOM_LEVEL = 16.5;
const DEFAULT_CAMERA_MODE = 'isometric';

// ─── 레이어 기본값 (그룹선·강조 기본 OFF) ─────────────────────────────────
const LAYER_STORAGE_KEY = 'map_layers_v1';

export const LAYER_DEFAULTS = {
  showOsmMap:              true,
  showGroundMesh:          false,
  showSeoulRoads:          true,
  showSeoulNature:         false,
  showLanduseTextureLayer: false,
  showRoadSplitLayer:      false,
  showLanduseZones:        false,
  showHeightMap:           false,
  showDistrictBoundaries:  false,
  showGroupBoundaries:     false,   // ← 기본 OFF
  showMicroBoundaries:     false,
  highlightCurrentGroup:   false,   // ← 기본 OFF
  showCurrentGroupTexture: true,
  showCullRadius:          false,
  showGroupColors:         false,
  showGroupArea:           false,
  showPartitionFill:       false,
  showElevation:           false,
  worldEditorOpen:         false,
  roadTypeFilters: { major: true, mid: true, alley: true, pedestrian: true, service: true },
  landuseFilters: {
    residential: true, commercial: true, industrial: true,
    institutional: true, educational: true, medical: true, parking: true,
    natural_site: true, military: true, religious: true, sports: true,
    cemetery: true, transport: true, port: true, unexplored: true,
  },
};

function loadLayers() {
  try {
    const raw = localStorage.getItem(LAYER_STORAGE_KEY);
    if (!raw) return { ...LAYER_DEFAULTS };
    return { ...LAYER_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...LAYER_DEFAULTS };
  }
}

// ─── 카메라 로드 헬퍼 ─────────────────────────────────────────────────────
const loadStoredZoomLevel = () => {
  try {
    const raw = Number(localStorage.getItem(CAMERA_STORAGE_KEYS.zoomLevel));
    if (Number.isFinite(raw)) return Math.max(6, Math.min(23.5, raw));
  } catch (_) {}
  return DEFAULT_ZOOM_LEVEL;
};

const loadStoredCameraMode = () => {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEYS.cameraMode);
    if (raw === 'isometric' || raw === '360') return raw;
  } catch (_) {}
  return DEFAULT_CAMERA_MODE;
};

export const clampZoomLevel = (value) => Math.max(6, Math.min(23.5, value));

// ─── 훅 ──────────────────────────────────────────────────────────────────
export function useMapSettings() {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // 카메라 (localStorage만)
  const [zoomLevel, setZoomLevel] = useState(loadStoredZoomLevel);
  const [cameraMode, setCameraMode] = useState(loadStoredCameraMode);

  // 레이어 (localStorage + DB 동기화)
  const [layers, setLayers] = useState(loadLayers);
  const dbSyncedRef = useRef(false);
  const saveTimerRef = useRef(null);

  // 텍스처 폴더 (localStorage만)
  const [groundTextureFolder, setGroundTextureFolder] = useState(
    () => localStorage.getItem('ground_texture_folder') || ''
  );
  const [roadTextureFolder, setRoadTextureFolder] = useState(
    () => localStorage.getItem('road_texture_folder') || ''
  );

  const { availableFolders: availableGroundTextureFolders } = useTextureFolders(
    worldApi.getBlockTextureFolders, groundTextureFolder, setGroundTextureFolder
  );
  const { availableFolders: availableRoadTextureFolders } = useTextureFolders(
    worldApi.getRoadTextureFolders, roadTextureFolder, setRoadTextureFolder
  );

  // ── 로그인 시 DB에서 레이어 설정 로드 (최초 1회) ──────────────────────
  useEffect(() => {
    if (!user?.id || dbSyncedRef.current) return;
    dbSyncedRef.current = true;
    gameApi.getSettings(user.id)
      .then(res => {
        const saved = res.data?.settings?.map_layers;
        if (saved && typeof saved === 'object') {
          const merged = { ...LAYER_DEFAULTS, ...saved };
          setLayers(merged);
          try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(merged)); } catch (_) {}
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // ── 레이어 변경 → localStorage 즉시 + DB debounce(1.2s) ───────────────
  useEffect(() => {
    try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(layers)); } catch (_) {}

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const uid = userRef.current?.id;
      if (uid) {
        gameApi.saveSettings(uid, { map_layers: layers }).catch(() => {});
      }
    }, 1200);
  }, [layers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 카메라 localStorage 저장 ────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(CAMERA_STORAGE_KEYS.zoomLevel, String(zoomLevel)); } catch (_) {}
  }, [zoomLevel]);

  useEffect(() => {
    try { localStorage.setItem(CAMERA_STORAGE_KEYS.cameraMode, cameraMode); } catch (_) {}
  }, [cameraMode]);

  // ── 텍스처 폴더 localStorage 저장 ───────────────────────────────────────
  useEffect(() => {
    if (groundTextureFolder) {
      localStorage.setItem('ground_texture_folder', groundTextureFolder);
    } else {
      localStorage.removeItem('ground_texture_folder');
    }
  }, [groundTextureFolder]);

  useEffect(() => {
    if (roadTextureFolder) {
      localStorage.setItem('road_texture_folder', roadTextureFolder);
    } else {
      localStorage.removeItem('road_texture_folder');
    }
  }, [roadTextureFolder]);

  // ── 레이어 setter 팩토리 ─────────────────────────────────────────────────
  const makeLayerSetter = useCallback(
    (key) => (value) => setLayers(prev => ({ ...prev, [key]: value })),
    []
  );

  // boolean/primitive 키 (객체 타입 제외)
  const primitiveLayerKeys = Object.keys(LAYER_DEFAULTS).filter(
    k => !['roadTypeFilters', 'landuseFilters'].includes(k)
  );

  // ── mapSettings 조립 ─────────────────────────────────────────────────────
  const mapSettings = {
    // 레이어 값
    ...layers,

    // boolean setter들 (setShowOsmMap, setShowGroupBoundaries, ...)
    ...Object.fromEntries(
      primitiveLayerKeys.map(key => [
        `set${key.charAt(0).toUpperCase()}${key.slice(1)}`,
        makeLayerSetter(key),
      ])
    ),

    // 객체 타입 setters
    setRoadTypeFilters: (v) => setLayers(prev => ({ ...prev, roadTypeFilters: v })),
    setLanduseFilters:  (v) => setLayers(prev => ({ ...prev, landuseFilters: v })),

    // 카메라
    zoomLevel, setZoomLevel,
    cameraMode, setCameraMode,

    // 텍스처 폴더
    groundTextureFolder, setGroundTextureFolder, availableGroundTextureFolders,
    roadTextureFolder,   setRoadTextureFolder,   availableRoadTextureFolders,

    // 편의 액션
    onPlayView: () => { setZoomLevel(18.5); setCameraMode('isometric'); },
  };

  return { mapSettings, zoomLevel, setZoomLevel, cameraMode };
}
