import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import TerrainTile from './TerrainTile';
import { gameToGps, LAT_TO_M, LNG_TO_M } from './mapConfig';

const TILE_SIZE = 1000; // 1km x 1km 타일

const TerrainStreamingSystem = ({ playerPos }) => {
  const [activeTiles, setActiveTiles] = useState({});
  const lastTileRef = useRef({ x: -999, z: -999 });

  const getTileIdx = (pos) => ({
    x: Math.floor(pos.x / TILE_SIZE),
    z: Math.floor(pos.z / TILE_SIZE)
  });

  useFrame(() => {
    if (!playerPos) return;

    const currentIdx = getTileIdx(playerPos);

    // 타일 인덱스가 바뀌었을 때만 업데이트
    if (currentIdx.x !== lastTileRef.current.x || currentIdx.z !== lastTileRef.current.z) {
      lastTileRef.current = currentIdx;

      const newTiles = {};
      // 캐릭터 주변 3x3 타일 유지
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const tx = currentIdx.x + dx;
          const tz = currentIdx.z + dz;
          const key = `${tx}_${tz}`;

          const centerX = tx * TILE_SIZE + TILE_SIZE / 2;
          const centerZ = tz * TILE_SIZE + TILE_SIZE / 2;
          const gps = gameToGps(centerX, centerZ);

          newTiles[key] = {
            id: key,
            centerX,
            centerZ,
            lat: gps.lat,
            lng: gps.lng
          };
        }
      }
      setActiveTiles(newTiles);
    }
  });

  return (
    <group name="terrain-streaming">
      {Object.values(activeTiles).map(tile => (
        <TerrainTile
          key={tile.id}
          lat={tile.lat}
          lng={tile.lng}
          centerX={tile.centerX}
          centerZ={tile.centerZ}
          size={TILE_SIZE}
        />
      ))}
    </group>
  );
};

export default TerrainStreamingSystem;
