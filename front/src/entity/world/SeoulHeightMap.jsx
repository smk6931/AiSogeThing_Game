import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ===================================
// Zone 기반 정점 페인팅 유틸리티
// ===================================

// 레이캐스팅 방식 Point-in-Polygon
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

// BBox 사전 계산으로 PiP 최적화
const precomputeZoneBBox = (zones) => {
  const result = {};
  for (const zoneName of ['water', 'park', 'forest', 'residential']) {
    const polygons = (zones[zoneName] || []).filter(f => f.type === 'polygon' && f.coords?.length >= 3);
    result[zoneName] = polygons.map(f => {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lat, lng] of f.coords) {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      }
      return { minLat, maxLat, minLng, maxLng, coords: f.coords };
    });
  }
  return result;
};

// Zone별 정점 색상 (셰이더가 이 값을 보고 텍스처를 선택)
const ZONE_PAINT = {
  water: [0.04, 0.18, 0.88], // 진한 파랑 → 셰이더 water 경로
  park: [0.15, 0.72, 0.15], // 선명한 초록 → 셰이더 grass 경로
  forest: [0.08, 0.45, 0.08], // 짙은 초록 → 셰이더 grass 경로
  residential: [0.75, 0.68, 0.52], // 베이지 → 셰이더 sand 경로
};
const ZONE_PRIORITY = ['water', 'park', 'forest', 'residential'];


// [수정] 절차적 캔버스 텍스처 대신 고화질 실사 이미지 텍스처를 사용합니다.
const TEXTURE_PATHS = {
  grass: '/textures/grass.png',
  rock: '/textures/rock.png',
  sand: '/textures/sand.png'
};


// ===========================
// 고도 기반 버텍스 컬러 팔레트
// ===========================
const getElevColor = (relElev, totalRange) => {
  const t = relElev / Math.max(totalRange, 1);
  const c = new THREE.Color();
  // 더 진하고 선명한 물 색상 (0.05 이하)
  if (t < 0.05) c.setRGB(0.1, 0.4, 1.0);
  else if (t < 0.12) c.setRGB(0.7, 0.7, 0.5);
  else if (t < 0.35) c.setRGB(0.3, 0.6, 0.2);
  else if (t < 0.60) c.setRGB(0.2, 0.4, 0.1);
  else if (t < 0.85) c.setRGB(0.4, 0.3, 0.2);
  else c.setRGB(0.6, 0.6, 0.6);
  return c;
};

// ===========================
// 고도 기반 상세 컬러 판별 (메모리 최적화)
// ===========================
const getDetailedColor = (relElev) => {
  const c = new THREE.Color();
  if (relElev < 10.0) c.setHex(0x1a3a5a);      // 차분한 남색 (물)
  else if (relElev < 22.0) c.setHex(0xa08c6a); // 샌드/해변
  else if (relElev < 80.0) c.setHex(0x4a6a3a); // 평지 그린
  else if (relElev < 200.0) c.setHex(0x354e2a); // 딥 그린 (언덕)
  else if (relElev < 450.0) c.setHex(0x5a4a3a); // 바위 브라운
  else c.setHex(0x888888);                    // 그레이 (고지대)
  return c;
};



// ===========================
// 메인 컴포넌트 (Memoized for stability)
// ===========================

const SeoulHeightMap = React.memo(({
  visible = true, playerRef, heightScale = 1.0,
  zoneData = null, currentDistrict = null, currentDong = null
}) => {

  const [data, setData] = useState(null);
  const built = useRef(false);
  const materialRef = useRef();

  useEffect(() => {
    if (!visible || built.current) return;
    fetch('/seoul_heightmap.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        built.current = true;
      })
      .catch(err => console.error('[HeightMap] 로딩 실패:', err));
  }, [visible]);

  // [수정] 하단 텍스처 로딩 로직 개선
  const loadedTextures = useTexture(TEXTURE_PATHS);

  const textures = useMemo(() => {
    const t = { ...loadedTextures };
    // [수정] 30km 맵에서 텍스처 재질이 너무 촘촘해서 안 보이던 현상 해결
    // 30,000m / 1,200회 = 한 타일당 25m (재질감이 뚜렷하게 보임)
    const repeatSize = 100;

    Object.values(t).forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatSize, repeatSize);
      tex.needsUpdate = true;
    });
    return t;
  }, [loadedTextures]);


  // Spotlight 쉐이더 유니폼 (모든 텍스처 전달)
  const uniforms = useMemo(() => ({
    uPlayerPos: { value: new THREE.Vector2(0, 0) },
    uHighlightRadius: { value: 800.0 }, // 반경을 조금 더 넓힘
    tGrass: { value: textures.grass },
    tRock: { value: textures.rock },
    tSand: { value: textures.sand },
  }), [textures]);

  // 매 프레임 플레이어 위치를 쉐이더에 전달 (Spotlight 효과)
  useFrame(() => {
    if (playerRef?.current && uniforms?.uPlayerPos) {
      const pos = playerRef.current.position;
      uniforms.uPlayerPos.value.set(pos.x, pos.z);
    }
  });


  const geometry = useMemo(() => {
    if (!data) return null;
    const { grid_size, world_width, world_height, elevations, elev_min } = data;
    const seg = grid_size - 1;

    // 그룹의 월드 위치 (GPS 역산에 필요)
    const posX = data.offset_x + world_width / 2;
    const posZ = data.offset_z + world_height / 2;

    const geo = new THREE.PlaneGeometry(world_width, world_height, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position.array;
    const vertCount = grid_size * grid_size;
    const colors = new Float32Array(vertCount * 4); // RGBA (알파 채널 추가)

    // 마스크 최적화를 위한 BBox 사전 계산 (동이 있으면 동을, 없으면 구를 사용)
    const activeMaskArea = currentDong || currentDistrict;
    let maskBBox = null;
    if (activeMaskArea?.coords) {
      maskBBox = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
      for (const [lat, lng] of activeMaskArea.coords) {
        if (lat < maskBBox.minLat) maskBBox.minLat = lat;
        if (lat > maskBBox.maxLat) maskBBox.maxLat = lat;
        if (lng < maskBBox.minLng) maskBBox.minLng = lng;
        if (lng > maskBBox.maxLng) maskBBox.maxLng = lng;
      }
    }

    // [1단계] 고도 기반 기본 색상 & 마스크(Alpha) 판별
    for (let i = 0; i < vertCount; i++) {
      const rawElev = elevations[i] ?? elev_min;
      const relElev = Math.max(0, rawElev - elev_min);

      // [계단식 지형 구현] 고도 값을 10미터 단위로 양자화
      const stepHeight = 10.0;
      const quantizedElev = Math.floor(relElev / stepHeight) * stepHeight;
      positions[i * 3 + 1] = quantizedElev * heightScale;

      // [단순화] 초록색 계열의 층층이 명암 적용
      const c = new THREE.Color();
      if (relElev < 10.0) {
        c.setHex(0x1a3a5a); // 물 영역
      } else {
        // 계단형 느낌을 시각화하기 위해 양자화된 고도 기반 색상
        const tone = 0.2 + (quantizedElev / 400) * 0.4;
        c.setRGB(0.12, tone, 0.12);
      }

      colors[i * 4 + 0] = c.r;
      colors[i * 4 + 1] = c.g;
      colors[i * 4 + 2] = c.b;

      // 마스크 (알파) 적용
      let alpha = 1.0;
      if (activeMaskArea?.coords) {
        const worldX = posX + positions[i * 3 + 0];
        const worldZ = posZ + positions[i * 3 + 2];
        const vLat = GIS_ORIGIN.lat - worldZ / LAT_TO_M;
        const vLng = GIS_ORIGIN.lng + worldX / LNG_TO_M;

        if (vLat < maskBBox.minLat || vLat > maskBBox.maxLat || vLng < maskBBox.minLng || vLng > maskBBox.maxLng) {
          alpha = 0.0;
        } else if (!pointInPolygon(vLat, vLng, activeMaskArea.coords)) {
          alpha = 0.0;
        }
      }
      colors[i * 4 + 3] = alpha;
    }

    // [최적화] CPU 부하 방지를 위해 Zone PiP 루프 중단
    geo.attributes.position.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    return geo;
  }, [data, heightScale, currentDistrict, currentDong]);




  if (!visible || !geometry || !data) return null;

  const posX = data.offset_x + data.world_width / 2;
  const posZ = data.offset_z + data.world_height / 2;


  return (
    <group position={[posX, 0.01, posZ]}>


      {/* 1. 지형 메쉬 */}

      <mesh geometry={geometry} frustumCulled={false}>
        <meshStandardMaterial
          ref={materialRef}
          vertexColors={true}
          transparent={true} // 마스크 적용을 위해 투명화 지원
          alphaTest={0.5}
          roughness={1.0}
          metalness={0.0}
          onBeforeCompile={(shader) => {
            shader.uniforms.uPlayerPos = uniforms.uPlayerPos;

            shader.vertexShader = shader.vertexShader.replace(
              '#include <common>',
              `#include <common>
               varying vec3 vWorldPos;`
            );
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `#include <common>
               uniform vec2 uPlayerPos;
               varying vec3 vWorldPos;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <map_fragment>',
              `
              // 오직 버텍스 컬러와 고도를 이용한 쉐이딩만 수행 (최적화)
              diffuseColor.rgb = vColor.rgb;
              
              // [고급 효과] 수직 절벽 명암 강조 (입체감 유지)
              vec3 vFaceNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
              float isVertical = 1.0 - smoothstep(0.7, 0.9, vFaceNormal.y);
              diffuseColor.rgb *= (1.0 - isVertical * 0.4);

              // [마스크 처리]
              diffuseColor.a = vColor.a;
              if (diffuseColor.a < 0.1) discard;
              `
            );
          }}
        />
      </mesh>


    </group>

  );
});

export default SeoulHeightMap;
