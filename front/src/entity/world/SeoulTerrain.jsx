import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import worldApi from '@api/world';
import { getTerrainHeight, loadHeightMap } from './terrainHandler';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ===========================
// 레이어별 색상
// ===========================
const COLORS = {
  water: new THREE.Color(0x2a6ab5),
  forest: new THREE.Color(0x2d6a28),
  grass: new THREE.Color(0x5a9e45),
  road_major: new THREE.Color(0xffffff),
  road_mid: new THREE.Color(0xdddddd),
  road_minor: new THREE.Color(0xbbbbbb),
};

const ROAD_CLASS = {
  motorway: 'major', trunk: 'major', primary: 'major',
  secondary: 'mid', tertiary: 'mid',
  residential: 'minor', unclassified: 'minor', service: 'minor'
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

// 폴리곤 생성
function buildPolygonGeometry(features, maskArea = null) {
  const geos = [];
  const maskCoords = maskArea?.coords;

  for (const f of features) {
    if (!f.coords || f.coords.length < 3) continue;

    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(f.coords[0][0], f.coords[0][1]);
      shape.moveTo(first.x, first.z);
      for (let i = 1; i < f.coords.length; i++) {
        const p = gpsToGame(f.coords[i][0], f.coords[i][1]);
        shape.lineTo(p.x, p.z);
      }
      shape.closePath();
      geos.push(new THREE.ShapeGeometry(shape));
    } catch (_) { }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

// 라인 생성
function buildLineGeometry(features, maskArea = null) {
  const geos = [];

  for (const f of features) {
    const coords = f.coords;
    if (!coords || coords.length < 2) continue;

    const baseW = (f.highway === 'motorway' || f.highway === 'trunk') ? 40 : 25;
    const halfW = (f.width || baseW) / 2;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = gpsToGame(coords[i][0], coords[i][1]);
      const p2 = gpsToGame(coords[i + 1][0], coords[i + 1][1]);

      const ax = p1.x, az = p1.z;
      const bx = p2.x, bz = p2.z;
      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      const nx = -dz / len * halfW;
      const nz = dx / len * halfW;

      // [OFF] 등고선 비활성화 - 모든 도로가 평면(Y=0.1)에 렌더링
      let ay = 0.1; // getTerrainHeight(ax, az);
      let by = 0.1; // getTerrainHeight(bx, bz);

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        ax + nx, ay + 0.15, az + nz,
        bx + nx, by + 0.15, bz + nz,
        bx - nx, by + 0.15, bz - nz,
        ax + nx, ay + 0.15, az + nz,
        bx - nx, by + 0.15, bz - nz,
        ax - nx, ay + 0.15, az - nz
      ]);
      const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geos.push(geometry);
    }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

const MergedMesh = ({ geometry, color, rotation = [0, 0, 0], position = [0, 0, 0], isWater = false, textureUrl = null, useStencil = false }) => {
  if (!geometry) return null;
  const isRoadMajor = color.r > 0.9 && color.g > 0.9;
  const materialProps = isWater ? {
    color: color, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3, emissive: color, emissiveIntensity: 0.3,
  } : isRoadMajor ? {
    color: '#ffffff',
    map: textureUrl ? new THREE.TextureLoader().load(textureUrl, (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 4);
    }) : null,
    emissive: textureUrl ? '#000000' : '#44aaff',
    emissiveIntensity: textureUrl ? 0 : 2.5,
    roughness: 0.5,
  } : { color: color };

  if (useStencil) {
    materialProps.stencilWrite = true;
    materialProps.stencilRef = 2; // Terrain 전용 Ref
    materialProps.stencilFunc = THREE.EqualStencilFunc;
  }

  return (
    <mesh rotation={rotation} position={position} renderOrder={10}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial {...materialProps} side={THREE.DoubleSide} />
    </mesh>
  );
};

// [NEW] 구/동 경계 모양대로 스텐실 도장을 찍어주는 컴포넌트
const TerrainMask = ({ maskArea, elevation }) => {
  const geo = useMemo(() => {
    if (!maskArea || !maskArea.coords || maskArea.coords.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(maskArea.coords[0][0], maskArea.coords[0][1]);
      shape.moveTo(first.x, first.z);
      for (let i = 1; i < maskArea.coords.length; i++) {
        const p = gpsToGame(maskArea.coords[i][0], maskArea.coords[i][1]);
        shape.lineTo(p.x, p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (e) { return null; }
  }, [maskArea]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={5}>
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        depthTest={false}
        stencilWrite={true}
        stencilRef={2}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilZPass={THREE.ReplaceStencilOp}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const SeoulTerrain = ({
  visible = true, showRoads = true, showNature = true, roadTextureUrl = null,
  districtId = null, dongId = null, currentDistrict = null, currentDong = null,
  elevation = 0, shiftX = -450, shiftZ = 320
}) => {
  const [data, setData] = useState(null);
  const [geos, setGeos] = useState(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!visible || loadingRef.current) return;
    const loadData = async () => {
      loadingRef.current = true;
      try {
        let terrainData;
        if (dongId) {
          const res = await worldApi.getDongTerrain(dongId);
          terrainData = res.data;
        } else if (districtId) {
          const res = await worldApi.getDistrictTerrain(districtId);
          terrainData = res.data;
        } else {
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
  }, [visible, districtId, dongId]);

  useEffect(() => {
    if (!data) return;
    const build = async () => {
      const { water, forest, grass, roads } = data.layers;
      const roadFeatures = dongId ? roads : roads.filter(r => ROAD_CLASS[r.highway] === 'major' || ROAD_CLASS[r.highway] === 'mid');
      const maskArea = currentDong || currentDistrict;

      setGeos({
        grass: buildPolygonGeometry(grass.filter(f => f.type === 'polygon'), maskArea),
        forest: buildPolygonGeometry(forest.filter(f => f.type === 'polygon'), maskArea),
        waterPoly: buildPolygonGeometry(water.filter(f => f.type === 'polygon'), maskArea),
        waterLine: buildLineGeometry(water.filter(f => f.type === 'line'), maskArea),
        roadFeatures: buildLineGeometry(roadFeatures, maskArea),
        shiftX: 0, shiftZ: 0
      });
    };
    build();
  }, [data, shiftX, shiftZ, currentDistrict, currentDong]);

  if (!visible || !geos) return null;

  const activeMask = currentDong || currentDistrict;

  return (
    <group name="seoul-terrain-group" position={[geos.shiftX, elevation, geos.shiftZ]}>

      {/* 0. 스텐실 마스크 렌더링 (구/동 모양 도장 찍기) */}
      {activeMask && <TerrainMask maskArea={activeMask} elevation={0.01} />}

      {showNature && (
        <group name="nature-layer">
          <MergedMesh geometry={geos.grass} color={COLORS.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.forest} color={COLORS.forest} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.waterPoly} color={COLORS.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} isWater={true} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.waterLine} color={COLORS.water} isWater={true} useStencil={!!activeMask} />
        </group>
      )}
      {showRoads && (
        <group name="roads-layer" position={[0, 0.05, 0]}>
          <MergedMesh geometry={geos.roadFeatures} color={COLORS.road_major} textureUrl={roadTextureUrl} useStencil={!!activeMask} />
        </group>
      )}
    </group>
  );
};

export default SeoulTerrain;
