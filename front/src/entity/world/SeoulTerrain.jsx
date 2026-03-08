import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTerrainHeight, loadHeightMap } from './terrainHandler';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ===========================
// 레이어별 색상
// ===========================
const COLORS = {
  water: new THREE.Color(0x2a6ab5), // 더 깊은 파란색
  forest: new THREE.Color(0x2d6a28),
  grass: new THREE.Color(0x5a9e45),
  road_major: new THREE.Color(0xffffff), // 완전히 하얀색으로 가시성 확보
  road_mid: new THREE.Color(0xdddddd),
  road_minor: new THREE.Color(0xbbbbbb),
};


const ROAD_CLASS = {
  motorway: 'major', trunk: 'major', primary: 'major',
  secondary: 'mid', tertiary: 'mid',
};

// GPS → 게임 좌표 변환
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// Ray-casting Point-in-Polygon
const pointInPolygon = (lat, lng, coords) => {
  let inside = false;
  const n = coords.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = coords[i][0], xi = coords[i][1];
    const yj = coords[j][0], xj = coords[j][1];
    if (((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

// ===========================
// 폴리곤 → merged geometry
// ===========================
function buildPolygonGeometry(features, currentDistrict = null) {
  const geos = [];
  const districtCoords = currentDistrict?.coords;

  for (const f of features) {
    if (!f.coords || f.coords.length < 3) continue;

    // [최적화] 구 경계선 밖의 데이터는 원천 배제
    if (districtCoords) {
      const [lat, lng] = f.coords[0];
      if (!pointInPolygon(lat, lng, districtCoords)) continue;
    }

    try {
      const shape = new THREE.Shape();
      // 데이터가 GPS인 경우 변환
      const isGps = f.coords[0][0] > 30; // 37.xxx 위도 판별

      const first = isGps ? gpsToGame(f.coords[0][0], f.coords[0][1]) : { x: f.coords[0][0], z: f.coords[0][1] };
      shape.moveTo(first.x, first.z);

      for (let i = 1; i < f.coords.length; i++) {
        const p = isGps ? gpsToGame(f.coords[i][0], f.coords[i][1]) : { x: f.coords[i][0], z: f.coords[i][1] };
        shape.lineTo(p.x, p.z);
      }
      shape.closePath();
      geos.push(new THREE.ShapeGeometry(shape));
    } catch (_) { }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

// ===========================
// 선 → merged geometry
// ===========================
function buildLineGeometry(features, currentDistrict = null) {
  const geos = [];
  const districtCoords = currentDistrict?.coords;

  for (const f of features) {
    const coords = f.coords;
    if (!coords || coords.length < 2) continue;

    // [최적화] 구 경계선 밖의 데이터는 원천 배제
    if (districtCoords) {
      const [lat, lng] = coords[0];
      if (!pointInPolygon(lat, lng, districtCoords)) continue;
    }

    const isGps = coords[0][0] > 30;
    // 브릿지 속성이 있거나 한강 위인 경우 두께와 높이 보정용 플래그
    const isBridge = f.bridge === 'yes' || f.highway === 'motorway_link';
    // [수정] 도로 폭을 더 과감하게 확장 (RPG 동선 느낌)
    const baseW = (f.highway === 'motorway' || f.highway === 'trunk') ? 40 : 25;
    const halfW = (f.width || baseW) / 2;



    if (!coords || coords.length < 2) continue;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = isGps ? gpsToGame(coords[i][0], coords[i][1]) : { x: coords[i][0], z: coords[i][1] };
      const p2 = isGps ? gpsToGame(coords[i + 1][0], coords[i + 1][1]) : { x: coords[i + 1][0], z: coords[i + 1][1] };

      const ax = p1.x, az = p1.z;
      const bx = p2.x, bz = p2.z;

      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      const nx = -dz / len * halfW;
      const nz = dx / len * halfW;

      // [핵심] 지형 높이 샘플링 (레이어 정합의 핵심)
      let ay = getTerrainHeight(ax, az);
      let by = getTerrainHeight(bx, bz);

      // [다리 보정] 한강(고도 4미만 저지대) 위이거나 다리인 경우 수면 위(8.0)로 띄움
      if (isBridge || ay < 4.0 || by < 4.0) {
        ay = Math.max(ay, 8.0);
        by = Math.max(by, 8.0);
      }

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        ax + nx, ay + 0.15, az + nz, // p1
        bx + nx, by + 0.15, bz + nz, // p2
        bx - nx, by + 0.15, bz - nz, // p3

        ax + nx, ay + 0.15, az + nz, // p1
        bx - nx, by + 0.15, bz - nz, // p3
        ax - nx, ay + 0.15, az - nz  // p4
      ]);

      // UV 매핑 추가 (반복되는 텍스처를 위해)
      const uvs = new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geos.push(geometry);
    }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

// ===========================
// 단일 머지 메시 (재질 업그레이드)
// ===========================
function MergedMesh({ geometry, color, rotation = [0, 0, 0], position = [0, 0, 0], isWater = false, textureUrl = null }) {
  if (!geometry) return null;

  const isRoadMajor = color.r > 0.9 && color.g > 0.9; // 아까 설정한 밝은 아이보리색 판별

  const materialProps = isWater ? {
    color: color,
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.3,
  } : isRoadMajor ? {
    color: textureUrl ? '#ffffff' : '#ffffff',
    map: textureUrl ? new THREE.TextureLoader().load(textureUrl, (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 4); // 도로 방향으로 반복되도록 설정
    }) : null,
    emissive: textureUrl ? '#000000' : '#44aaff',
    emissiveIntensity: textureUrl ? 0 : 2.5,
    roughness: 0.5,
  } : {
    color: color,
  };


  return (
    <mesh rotation={rotation} position={position}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial {...materialProps} side={THREE.DoubleSide} />
    </mesh>
  );
}

import worldApi from '@api/world';

const SeoulTerrain = ({
  visible = true,
  showRoads = true,
  showNature = true,
  roadTextureUrl = null,
  districtId = null, // [신규] 특정 구 ID
  currentDistrict = null, // [신규] 구 기반 마스킹용
  shiftX = -450,
  shiftZ = 320
}) => {
  const [data, setData] = useState(null);
  const [geos, setGeos] = useState(null);
  const loadingRef = useRef(false);

  // 1. 데이터 로딩
  useEffect(() => {
    if (!visible || loadingRef.current) return;

    const loadData = async () => {
      loadingRef.current = true;
      try {
        let terrainData;
        if (districtId) {
          // [개선] 구별로 OSM에서 직접 추출한 데이터를 가져옵니다 (Artifact 방지)
          console.log(`[SeoulTerrain] '${districtId}' 구 데이터 API 요청...`);
          const res = await worldApi.getDistrictTerrain(districtId);
          terrainData = res.data;
        } else {
          // Fallback: 기존 정적 파일
          const res = await fetch('/seoul_terrain.json');
          terrainData = await res.json();
        }
        setData(terrainData);
      } catch (err) {
        console.error('[SeoulTerrain] 로딩 실패:', err);
      } finally {
        loadingRef.current = false;
      }
    };

    loadData();
  }, [visible, districtId]);

  // 2. 지오메트리 생성/업데이트
  useEffect(() => {
    if (!data) return;

    const build = async () => {
      const { water, forest, grass, roads } = data.layers;
      const roadMajor = roads.filter(r => ROAD_CLASS[r.highway] === 'major');

      if (typeof loadHeightMap === 'function') await loadHeightMap();

      // GPS 기반 데이터면 shift를 무시하고 0,0 기준으로 정렬 (gpsToGame이 처리함)
      const isGpsData = (grass[0]?.coords?.[0]?.[0] > 30) || (roads[0]?.coords?.[0]?.[0] > 30);
      const activeShiftX = isGpsData ? 0 : shiftX;
      const activeShiftZ = isGpsData ? 0 : shiftZ;

      setGeos({
        grass: buildPolygonGeometry(grass.filter(f => f.type === 'polygon'), currentDistrict),
        forest: buildPolygonGeometry(forest.filter(f => f.type === 'polygon'), currentDistrict),
        waterPoly: buildPolygonGeometry(water.filter(f => f.type === 'polygon'), currentDistrict),
        waterLine: buildLineGeometry(water.filter(f => f.type === 'line'), currentDistrict),
        roadMajor: buildLineGeometry(roadMajor, currentDistrict),
        isGps: isGpsData,
        shiftX: activeShiftX,
        shiftZ: activeShiftZ
      });
      console.log(`[SeoulTerrain] 레이어 빌드 완료 (Type: ${isGpsData ? 'GPS' : 'Offset'}, Shift: ${activeShiftX}, ${activeShiftZ})`);
    };

    build();
  }, [data, shiftX, shiftZ, currentDistrict]);

  if (!visible || !geos) return null;

  return (
    <group name="seoul-terrain-group" position={[geos.shiftX, 0, geos.shiftZ]}>
      {/* 1. 자연 지형 레이어 (Nature) */}
      {showNature && (
        <group name="nature-layer">
          <MergedMesh geometry={geos.grass} color={COLORS.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
          <MergedMesh geometry={geos.forest} color={COLORS.forest} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />
          <MergedMesh geometry={geos.waterPoly} color={COLORS.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} isWater={true} />
          <MergedMesh geometry={geos.waterLine} color={COLORS.water} isWater={true} />
        </group>
      )}

      {/* 2. 도로 동선 레이어 (Roads) */}
      {showRoads && (
        <group name="roads-layer" position={[0, 0.05, 0]}>
          <MergedMesh geometry={geos.roadMajor} color={COLORS.road_major} textureUrl={roadTextureUrl} />
        </group>
      )}
    </group>
  );
};


export default SeoulTerrain;
