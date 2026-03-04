import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// 위경도를 OSM 타일 좌표(X, Y)로 변환하는 공식
const getTileCoords = (lat, lng, zoom) => {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lng + 180) / 360 * n);
  const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: xtile, y: ytile };
};

// 타일 좌표를 다시 위경도로 변환 (타일의 좌상단 기준)
const tileToGps = (x, y, zoom) => {
  const n = Math.pow(2, zoom);
  const lng = x / n * 360 - 180;
  const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = lat_rad * 180 / Math.PI;
  return { lat, lng };
};

const MapTile = ({ x, y, zoom, originGps, elevation = -0.05 }) => {
  const url = `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/${zoom}/${x}/${y}.png`;
  const texture = useTexture(url);

  // [최적화] 텍스처 컬러 공간 보정 (물 빠진 색감 해결)
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
    <group>
      <mesh
        position={[worldX + tileSizeWorld / 2, elevation, worldZ + tileSizeWorld / 2]} // 전달받은 elevation 사용
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[tileSizeWorld, tileSizeWorld]} />
        {/* meshBasicMaterial은 조명의 영향을 받지 않아 원본 색감 그대로 선명하게 보입니다 */}
        <meshBasicMaterial
          map={texture}
          transparent={false}
          opacity={1.0}
          side={THREE.FrontSide}
          toneMapped={false} // HDR 톤매핑에 의해 밝기가 변하는 것 방지
        />
      </mesh>
    </group>
  );
};


// 특정 위치에 고정된 크기(16레벨 지도 하나 크기)로 덧씌우는 AI 오버레이
const FixedOverlayTile = ({ originGps }) => {
  const aiTexture = useTexture('/ai_floor.png');

  // 파이썬 스크립트에서 캡처한 기준 좌표 (줌 16)
  const targetZoom = 16;
  const tileCoords = getTileCoords(GIS_ORIGIN.lat, GIS_ORIGIN.lng, targetZoom);
  const tileGps = tileToGps(tileCoords.x, tileCoords.y, targetZoom);

  const worldX = (tileGps.lng - originGps.lng) * LNG_TO_M;
  const worldZ = (originGps.lat - tileGps.lat) * LAT_TO_M;
  const tileSizeWorld = (360 / Math.pow(2, targetZoom)) * LNG_TO_M;

  return (
    <mesh
      position={[worldX + tileSizeWorld / 2, 0.2, worldZ + tileSizeWorld / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[tileSizeWorld, tileSizeWorld]} />
      <meshStandardMaterial map={aiTexture} />
    </mesh>
  );
};

// [NEW] 서울 구역 이외의 배경을 어둡게 마스크 처리하는 오버레이
const SeoulMask = ({ districts, elevation }) => {
  const geometry = useMemo(() => {
    if (!districts || districts.length === 0) return null;

    const shape = new THREE.Shape();
    shape.moveTo(-300000, -300000);
    shape.lineTo(300000, -300000);
    shape.lineTo(300000, 300000);
    shape.lineTo(-300000, 300000);
    shape.closePath();

    districts.forEach(d => {
      if (!d.coords || d.coords.length === 0) return;
      const hole = new THREE.Path();

      // 주의: Three.js ShapeGeometry 평면 좌표계(x, y) = 3D 월드의 (x, -worldZ)
      const firstX = (d.coords[0][1] - GIS_ORIGIN.lng) * LNG_TO_M;
      const firstY = -((GIS_ORIGIN.lat - d.coords[0][0]) * LAT_TO_M);
      hole.moveTo(firstX, firstY);

      for (let i = 1; i < d.coords.length; i++) {
        const px = (d.coords[i][1] - GIS_ORIGIN.lng) * LNG_TO_M;
        const py = -((GIS_ORIGIN.lat - d.coords[i][0]) * LAT_TO_M);
        hole.lineTo(px, py);
      }
      hole.closePath();
      shape.holes.push(hole);
    });

    return new THREE.ShapeGeometry(shape);
  }, [districts]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={-10}>
      <meshBasicMaterial color="#050510" transparent opacity={0.88} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};


const MapTiles = ({ playerPos, zoomLevel = 16, showOsmMap = true, cameraMode = 'isometric', elevation = -0.05, districts = [] }) => {
  const zoom = Math.max(13, Math.floor(zoomLevel || 16)); // 최소 줌 레벨 13 보장 (흐려짐 방지)

  // 현재 플레이어의 GPS 위치 계산
  const playerGps = useMemo(() => ({
    lat: GIS_ORIGIN.lat - (playerPos.z / LAT_TO_M),
    lng: GIS_ORIGIN.lng + (playerPos.x / LNG_TO_M)
  }), [playerPos.x, playerPos.z]);

  // 현재 중앙 타일 좌표
  const centerTile = useMemo(() => getTileCoords(playerGps.lat, playerGps.lng, zoom), [playerGps, zoom]);

  // 주변 타일 목록 생성 (쿼터뷰 모드일 땐 반경 축소하여 성능 향상)
  const tiles = useMemo(() => {
    const t = [];
    const radius = 5; // 퀘터뷰/360도 구분 없이 시원하게 반경 5타일(11x11) 로드
    for (let dx = -radius; dx <= radius; dx++) {

      for (let dy = -radius; dy <= radius; dy++) {
        t.push({ x: centerTile.x + dx, y: centerTile.y + dy });
      }
    }
    return t;
  }, [centerTile.x, centerTile.y, cameraMode]);

  return (
    <group>
      {/* 1. 밑바탕 카르토 실물 지도 1차 렌더링 (토글 가능) */}
      {showOsmMap && tiles.map(tile => (
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

      {/* 2. 서울 외곽 스크린 마스크 */}
      {showOsmMap && districts.length > 0 && (
        <SeoulMask districts={districts} elevation={elevation + 0.01} />
      )}

    </group>
  );
};

export default MapTiles;
