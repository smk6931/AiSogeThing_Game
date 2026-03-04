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

const SeoulHeightMap = React.memo(({ visible = true, playerRef, heightScale = 1.0, zoneData = null }) => {

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
    const colors = new Float32Array(vertCount * 3);

    // [1단계] 고도 기반 기본 색상
    for (let i = 0; i < vertCount; i++) {
      const rawElev = elevations[i] ?? elev_min;
      const relElev = Math.max(0, rawElev - elev_min);
      positions[i * 3 + 1] = relElev * heightScale;

      const c = getDetailedColor(relElev);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    // [2단계] Zone 데이터가 있으면 각 정점의 GPS 역산 → Zone 판정 → 색상 덮어쓰기
    if (zoneData?.zones) {
      console.log('[HeightMap] Zone 기반 텍스처 페인팅 시작...');
      const t0 = performance.now();
      const zoneBBoxes = precomputeZoneBBox(zoneData.zones);

      for (let i = 0; i < vertCount; i++) {
        // 정점의 로컬 게임 좌표 → 월드 좌표 → GPS
        const worldX = posX + positions[i * 3 + 0];
        const worldZ = posZ + positions[i * 3 + 2];
        const vLat = GIS_ORIGIN.lat - worldZ / LAT_TO_M;
        const vLng = GIS_ORIGIN.lng + worldX / LNG_TO_M;

        let matched = null;
        outer: for (const zoneName of ZONE_PRIORITY) {
          for (const bbox of zoneBBoxes[zoneName]) {
            if (vLat < bbox.minLat || vLat > bbox.maxLat ||
              vLng < bbox.minLng || vLng > bbox.maxLng) continue;
            if (pointInPolygon(vLat, vLng, bbox.coords)) {
              matched = zoneName;
              break outer;
            }
          }
        }

        if (matched) {
          const [r, g, b] = ZONE_PAINT[matched];
          colors[i * 3 + 0] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
        }
      }
      console.log(`[HeightMap] Zone 페인팅 완료: ${(performance.now() - t0).toFixed(0)}ms`);
    }

    geo.attributes.position.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    return geo;
  }, [data, heightScale, zoneData]);


  // 등고선(지형) 범위 바운더리 지오메트리 캐싱 (조건문 이전으로 이동 - Rules of Hooks)
  const boundaryGeo = useMemo(() => {
    return data ? new THREE.PlaneGeometry(data.world_width, data.world_height) : null;
  }, [data]);

  if (!visible || !geometry || !data || !boundaryGeo) return null;

  const posX = data.offset_x + data.world_width / 2;
  const posZ = data.offset_z + data.world_height / 2;


  return (
    <group position={[posX, 0.01, posZ]}>


      {/* 1. 지형 메쉬 */}

      <mesh geometry={geometry} frustumCulled={false}>
        <meshStandardMaterial
          ref={materialRef}
          vertexColors={true}
          roughness={0.9}
          metalness={0.0}
          onBeforeCompile={(shader) => {
            shader.uniforms.uPlayerPos = uniforms.uPlayerPos;
            shader.uniforms.uHighlightRadius = uniforms.uHighlightRadius;
            shader.uniforms.tGrass = uniforms.tGrass;
            shader.uniforms.tRock = uniforms.tRock;
            shader.uniforms.tSand = uniforms.tSand;

            shader.vertexShader = shader.vertexShader.replace(
              '#include <common>',
              `
              #include <common>
              varying vec3 vWorldPos;
              `
            );
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `
              #include <begin_vertex>
              vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform vec2 uPlayerPos;
              uniform float uHighlightRadius;
              uniform sampler2D tGrass;
              uniform sampler2D tRock;
              uniform sampler2D tSand;
              varying vec3 vWorldPos;
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <map_fragment>',
              `
              float dist = distance(vWorldPos.xz, uPlayerPos);
              // [최적화] 텍스처 경계를 훨씬 부드럽게 (0.5 ~ 1.0)
              float spotAlpha = 1.0 - smoothstep(uHighlightRadius * 0.5, uHighlightRadius, dist);
              
              vec2 uv = vWorldPos.xz * 0.025; 

              vec4 texGrass = texture2D(tGrass, uv);
              vec4 texRock  = texture2D(tRock, uv);
              vec4 texSand  = texture2D(tSand, uv * 1.5);
              
              // Vertex Color 기반 자동 바이옴 믹싱
              // B가 강하면 물(푸른빛), R이 강하면 바위(산), G가 중간이면 평지(풀)
              vec4 blendedTex;
              if (vColor.b > vColor.g + 0.1) {
                  // 물 영역 (텍스처보다는 깊은 색감 위주)
                  blendedTex = mix(vec4(0.05, 0.25, 0.6, 1.0), texSand, 0.2);
              } else if (vColor.r > vColor.g + 0.1) {
                  // 산/바위 영역
                  blendedTex = texRock;
              } else if (vColor.r > 0.7 && vColor.g > 0.6) {
                  // 모래/해변 영역
                  blendedTex = texSand;
              } else {
                  // 일반 평지/숲 영역
                  blendedTex = texGrass;
              }
              
              // 1. 텍스처와 버텍스 컬러 기본 합산 (스포트라이트 제약 없이 상시 노출)
              diffuseColor.rgb = vColor.rgb * blendedTex.rgb * 1.8;
              
              // 2. [고급 효과] 수직 절벽(Step Side) 강조 
              // dFdx/dFdy를 사용하여 '가파른 면'에 인위적인 쉐이딩 추가 (각진 느낌 강조)
              vec3 vFaceNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
              float isVertical = 1.0 - smoothstep(0.5, 0.7, vFaceNormal.y);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.65, isVertical);
              
              // 3. [고급 효과] 택티컬 그리드 (10m 간격)
              // 건축 설계도나 보드게임판 같은 정밀한 공간감을 부여합니다.
              float gridMajor = (mod(vWorldPos.x + 0.1, 10.0) < 0.22 || mod(vWorldPos.z + 0.1, 10.0) < 0.22) ? 1.0 : 0.0;
              float gridMinor = (mod(vWorldPos.x + 0.05, 2.0) < 0.12 || mod(vWorldPos.z + 0.05, 2.0) < 0.12) ? 0.4 : 0.0;
              float grid = max(gridMajor, gridMinor);
              diffuseColor.rgb += grid * 0.08; // 그리드 선을 은은하게 추가
              
              // 4. [고급 효과] 앰비언트 오클루전 (높이에 따른 어둡기 조절)
              float ao = 0.82 + 0.18 * smoothstep(0.0, 100.0, vWorldPos.y);
              diffuseColor.rgb *= ao;

              `
            );
          }}
        />
      </mesh>

      {/* 2. 지형 범위 인디케이터 (경계 상자) - 전체모드에서 한눈에 범위를 알 수 있음 */}
      <lineSegments position={[0, 50, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry attach="geometry" args={[boundaryGeo]} />
        <lineBasicMaterial attach="material" color="#ff3333" linewidth={4} transparent opacity={0.8} />
      </lineSegments>

      {/* 지형 범위 이름표 (바닥 텍스트 대신 중앙에 거대한 십자선 표기) */}
      <lineSegments position={[0, 48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry attach="geometry" args={[data.world_width, data.world_height, 2, 2]} />
        <meshBasicMaterial attach="material" color="#ff3333" wireframe transparent opacity={0.1} />
      </lineSegments>
    </group>

  );
});

export default SeoulHeightMap;
