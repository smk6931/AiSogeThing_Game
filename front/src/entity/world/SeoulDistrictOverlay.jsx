import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// GPS -> Game position 변환
const gpsToXZ = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M
});

// ===================================
// 장벽(Wall) 생성용 지오메트리 빌더
// ===================================
const buildDistrictWalls = (coords, height = 150, thickness = 20) => {
  if (!coords || coords.length < 2) return null;
  const geos = [];
  const halfT = thickness / 2;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = gpsToXZ(coords[i][0], coords[i][1]);
    const p2 = gpsToXZ(coords[i + 1][0], coords[i + 1][1]);

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.1) continue;

    const angle = Math.atan2(dz, dx);
    const boxGeo = new THREE.BoxGeometry(len, height, thickness);
    boxGeo.translate(len / 2, height / 2, 0);
    boxGeo.rotateY(-angle);
    boxGeo.translate(p1.x, 0, p1.z);
    geos.push(boxGeo);
  }

  if (geos.length === 0) return null;
  return mergeGeometries(geos, false);
};

// ===================================
// 바닥 실선(Line) 생성용 지오메트리 빌더
// ===================================
const buildDistrictLine = (coords) => {
  if (!coords || coords.length < 2) return null;
  const pts = coords.map(c => {
    const pos = gpsToXZ(c[0], c[1]);
    return new THREE.Vector3(pos.x, 0, pos.z);
  });
  return new THREE.BufferGeometry().setFromPoints(pts);
};

const SeoulDistrictOverlay = ({
  districts = [],
  currentDistrictId = null,
  currentDong = null,
  currentDongId = null,
  visible = true,
  elevation = 0.05
}) => {
  const [activeDistrict, setActiveDistrict] = useState(null);
  const [activeDong, setActiveDong] = useState(null);

  // 구(District) 상태 업데이트
  useEffect(() => {
    if (!visible || !districts) return;
    const found = districts.find(d => d.id === currentDistrictId);
    setActiveDistrict(found || null);
  }, [currentDistrictId, districts, visible]);

  // 동(Dong) 상태 업데이트
  useEffect(() => {
    if (!visible || !currentDong) {
      setActiveDong(null);
      return;
    }
    setActiveDong(currentDong);
  }, [currentDongId, currentDong, visible]);

  // 지오메트리 메모이제이션
  const districtWallGeo = useMemo(() => activeDistrict ? buildDistrictWalls(activeDistrict.coords, 150, 20) : null, [activeDistrict]);
  const dongWallGeo = useMemo(() => activeDong ? buildDistrictWalls(activeDong.coords, 80, 10) : null, [activeDong]);
  const districtLineGeo = useMemo(() => activeDistrict ? buildDistrictLine(activeDistrict.coords) : null, [activeDistrict]);
  const dongLineGeo = useMemo(() => activeDong ? buildDistrictLine(activeDong.coords) : null, [activeDong]);

  if (!visible) return null;

  return (
    <group name="seoul-boundaries" position={[0, elevation, 0]}>
      {/* 1. 구(District) 경계 - 빨간색 포스필드 */}
      {activeDistrict && (
        <group name="district-boundary">
          <mesh geometry={districtWallGeo} renderOrder={10}>
            <meshStandardMaterial
              color="#ff3333"
              transparent={true}
              opacity={0.3}
              emissive="#ff0000"
              emissiveIntensity={1.2}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <line geometry={districtLineGeo} position={[0, 0.5, 0]}>
            <lineBasicMaterial color="#ff5555" linewidth={3} transparent opacity={0.8} />
          </line>
          {/* 구 이름 표시 */}
          <Html position={[gpsToXZ(activeDistrict.center[0], activeDistrict.center[1]).x, 155, gpsToXZ(activeDistrict.center[0], activeDistrict.center[1]).z]} center>
            <div style={{ color: '#ff3333', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #ff3333', whiteSpace: 'nowrap' }}>
              {activeDistrict.name} (DISTRICT)
            </div>
          </Html>
        </group>
      )}

      {/* 2. 동(Dong) 경계 - 파란색 포스필드 (신규) */}
      {activeDong && (
        <group name="dong-boundary">
          <mesh geometry={dongWallGeo} renderOrder={11}>
            <meshStandardMaterial
              color="#4488ff"
              transparent={true}
              opacity={0.4}
              emissive="#0044ff"
              emissiveIntensity={1.8}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <line geometry={dongLineGeo} position={[0, 0.6, 0]}>
            <lineBasicMaterial color="#66aaff" linewidth={5} transparent opacity={0.9} />
          </line>
          {/* 동 이름 표시 */}
          <Html position={[gpsToXZ(activeDong.center[0], activeDong.center[1]).x, 85, gpsToXZ(activeDong.center[0], activeDong.center[1]).z]} center>
            <div style={{ color: '#4488ff', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #4488ff', whiteSpace: 'nowrap' }}>
              {activeDong.name} (ACTIVE DONG)
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};

export default SeoulDistrictOverlay;
