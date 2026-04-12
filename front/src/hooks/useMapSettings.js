import { useState, useEffect } from 'react';
import worldApi from '@api/world';
import { useTextureFolders } from './useTextureFolders';

const CAMERA_STORAGE_KEYS = {
  zoomLevel: 'game_camera_zoom_level',
  cameraMode: 'game_camera_mode',
};

const DEFAULT_ZOOM_LEVEL = 16.5;
const DEFAULT_CAMERA_MODE = 'isometric';

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

export function useMapSettings() {
  // Camera
  const [zoomLevel, setZoomLevel] = useState(loadStoredZoomLevel);
  const [cameraMode, setCameraMode] = useState(loadStoredCameraMode);

  // Map layers
  const [showOsmMap, setShowOsmMap] = useState(true);
  const [showSeoulRoads, setShowSeoulRoads] = useState(true);
  const [roadTypeFilters, setRoadTypeFilters] = useState({
    major: true, mid: true, alley: true, pedestrian: true, service: true,
  });
  const [showSeoulNature, setShowSeoulNature] = useState(false);
  const [showLanduseTextureLayer, setShowLanduseTextureLayer] = useState(false);
  const [showRoadSplitLayer, setShowRoadSplitLayer] = useState(false);
  const [showLanduseZones, setShowLanduseZones] = useState(false);
  const [landuseFilters, setLanduseFilters] = useState({
    residential: true, commercial: true, industrial: true,
    institutional: true, educational: true, medical: true, parking: true,
    natural_site: true, military: true, religious: true, sports: true,
    cemetery: true, transport: true, port: true, unexplored: true,
  });
  const [showHeightMap, setShowHeightMap] = useState(false);
  const [showGroundMesh, setShowGroundMesh] = useState(false);
  const [showDistrictBoundaries, setShowDistrictBoundaries] = useState(false);
  const [showMicroBoundaries, setShowMicroBoundaries] = useState(false);
  const [showGroupBoundaries, setShowGroupBoundaries] = useState(true);
  const [highlightCurrentGroup, setHighlightCurrentGroup] = useState(true);
  const [showCurrentGroupTexture, setShowCurrentGroupTexture] = useState(true);
  const [showCullRadius, setShowCullRadius] = useState(false);
  const [showGroupColors, setShowGroupColors] = useState(false);
  const [showGroupArea, setShowGroupArea] = useState(false);
  const [showPartitionFill, setShowPartitionFill] = useState(false);
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);

  // Texture folders
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

  // localStorage persistence
  useEffect(() => {
    try { localStorage.setItem(CAMERA_STORAGE_KEYS.zoomLevel, String(zoomLevel)); } catch (_) {}
  }, [zoomLevel]);

  useEffect(() => {
    try { localStorage.setItem(CAMERA_STORAGE_KEYS.cameraMode, cameraMode); } catch (_) {}
  }, [cameraMode]);

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

  const mapSettings = {
    zoomLevel, setZoomLevel,
    cameraMode, setCameraMode,
    showOsmMap, setShowOsmMap,
    showSeoulRoads, setShowSeoulRoads,
    roadTypeFilters, setRoadTypeFilters,
    showSeoulNature, setShowSeoulNature,
    showLanduseTextureLayer, setShowLanduseTextureLayer,
    showRoadSplitLayer, setShowRoadSplitLayer,
    showLanduseZones, setShowLanduseZones,
    landuseFilters, setLanduseFilters,
    showHeightMap, setShowHeightMap,
    showGroundMesh, setShowGroundMesh,
    showDistrictBoundaries, setShowDistrictBoundaries,
    showMicroBoundaries, setShowMicroBoundaries,
    showGroupBoundaries, setShowGroupBoundaries,
    highlightCurrentGroup, setHighlightCurrentGroup,
    showCurrentGroupTexture, setShowCurrentGroupTexture,
    showCullRadius, setShowCullRadius,
    showGroupColors, setShowGroupColors,
    showGroupArea, setShowGroupArea,
    showPartitionFill, setShowPartitionFill,
    worldEditorOpen, setWorldEditorOpen,
    groundTextureFolder, setGroundTextureFolder, availableGroundTextureFolders,
    roadTextureFolder, setRoadTextureFolder, availableRoadTextureFolders,
    onPlayView: () => { setZoomLevel(18.5); setCameraMode('isometric'); },
  };

  return { mapSettings, zoomLevel, setZoomLevel, cameraMode };
}
