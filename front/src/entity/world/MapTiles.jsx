import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

const getTileCoords = (lat, lng, zoom) => {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lng + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      n
  );
  return { x: xtile, y: ytile };
};

const tileToGps = (x, y, zoom) => {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
};

const MapTile = ({ x, y, zoom, originGps, elevation = -0.05 }) => {
  const url = `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/${zoom}/${x}/${y}.png`;
  const texture = useTexture(url);

  useMemo(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    }
  }, [texture]);

  const tileGps = tileToGps(x, y, zoom);
  const worldX = (tileGps.lng - originGps.lng) * LNG_TO_M;
  const worldZ = (originGps.lat - tileGps.lat) * LAT_TO_M;
  const tileSizeWorld = (360 / Math.pow(2, zoom)) * LNG_TO_M;

  return (
    <mesh
      position={[worldX + tileSizeWorld / 2, elevation, worldZ + tileSizeWorld / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[tileSizeWorld, tileSizeWorld]} />
      <meshBasicMaterial
        map={texture}
        transparent={false}
        opacity={1.0}
        side={THREE.FrontSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const FallbackUnderlay = ({ playerPos, size = 7000, elevation = -0.08 }) => (
  <mesh
    position={[playerPos.x, elevation, playerPos.z]}
    rotation={[-Math.PI / 2, 0, 0]}
    renderOrder={-50}
  >
    <planeGeometry args={[size, size]} />
    <meshBasicMaterial color="#101315" toneMapped={false} />
  </mesh>
);

const MapTiles = ({
  playerPos,
  zoomLevel = 16,
  showOsmMap = true,
  cameraMode = 'isometric',
  elevation = -0.05,
}) => {
  const zoom = Math.max(13, Math.floor(zoomLevel || 16));

  const playerGps = useMemo(
    () => ({
      lat: GIS_ORIGIN.lat - playerPos.z / LAT_TO_M,
      lng: GIS_ORIGIN.lng + playerPos.x / LNG_TO_M,
    }),
    [playerPos.x, playerPos.z]
  );

  const centerTile = useMemo(
    () => getTileCoords(playerGps.lat, playerGps.lng, zoom),
    [playerGps.lat, playerGps.lng, zoom]
  );

  const underlaySize = useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const longestEdge = Math.max(viewportWidth, viewportHeight);
    const perspectiveFactor = cameraMode === 'isometric' ? 7.5 : 4.5;
    const zoomFactor = zoom <= 14 ? 1.7 : zoom <= 15 ? 1.35 : 1.15;
    return Math.max(120000, longestEdge * perspectiveFactor * zoomFactor);
  }, [cameraMode, zoom]);

  const tiles = useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const isPortrait = viewportHeight > viewportWidth;
    const zoomSlack = zoom <= 14 ? 2 : zoom <= 15 ? 1 : 0;

    let radiusX = cameraMode === 'isometric' ? 5 : 5;
    let radiusY = cameraMode === 'isometric' ? 8 : 5;

    if (isPortrait) {
      radiusX += 1;
      radiusY += cameraMode === 'isometric' ? 4 : 2;
    }

    radiusX += zoomSlack;
    radiusY += zoomSlack;

    const nextTiles = [];
    for (let dx = -radiusX; dx <= radiusX; dx++) {
      for (let dy = -radiusY; dy <= radiusY; dy++) {
        nextTiles.push({ x: centerTile.x + dx, y: centerTile.y + dy });
      }
    }
    return nextTiles;
  }, [cameraMode, centerTile.x, centerTile.y, zoom]);

  return (
    <group>
      <FallbackUnderlay playerPos={playerPos} size={underlaySize} elevation={elevation - 0.02} />
      {showOsmMap &&
        tiles.map((tile) => (
          <React.Suspense key={`${tile.x}-${tile.y}-${zoom}`} fallback={null}>
            <MapTile
              x={tile.x}
              y={tile.y}
              zoom={zoom}
              originGps={GIS_ORIGIN}
              elevation={elevation}
            />
          </React.Suspense>
        ))}
    </group>
  );
};

export default MapTiles;
