import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';

// 맵의 중심을 캐릭터 위치에 맞게 업데이트하는 컴포넌트
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);
  return null;
};

const LeafletMapBackground = ({ playerPositionRef, zoomLevel, districts = [], currentDistrictId = null }) => {
  const LAT_PER_M = 1 / LAT_TO_M;
  const LNG_PER_M = 1 / LNG_TO_M;

  const [mapCenter, setMapCenter] = useState([GIS_ORIGIN.lat, GIS_ORIGIN.lng]);

  // 실시간 지도 중심 동기화 (성능 최적화를 위해 500ms 주기로 업데이트)
  useEffect(() => {
    let lastMappedCenter = [GIS_ORIGIN.lat, GIS_ORIGIN.lng];

    const syncMap = () => {
      if (playerPositionRef && playerPositionRef.current) {
        const { x, z } = playerPositionRef.current;
        const lat = GIS_ORIGIN.lat - (z * LAT_PER_M);
        const lng = GIS_ORIGIN.lng + (x * LNG_PER_M);

        const distSq = Math.pow(lat - lastMappedCenter[0], 2) + Math.pow(lng - lastMappedCenter[1], 2);
        if (distSq > 0.00000001) { // 정밀도 조정: 충분히 움직였을 때만
          setMapCenter([lat, lng]);
          lastMappedCenter = [lat, lng];
        }
      }
    };

    const interval = setInterval(syncMap, 500);
    return () => clearInterval(interval);
  }, [playerPositionRef]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#000' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        zoomControl={false}
        scrollWheelZoom={false}
        touchZoom={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />

        {/* 서울 외곽 어둡게 마스크 (미니맵 시야 제한용) */}
        {districts && districts.length > 0 && (
          <Polygon
            positions={[
              [[-90, -180], [90, -180], [90, 180], [-90, 180]], // 전 세계 박스
              ...districts.map(d => d.coords) // 서울 구역들 구멍(hole)으로 뚫림
            ]}
            pathOptions={{ color: 'transparent', fillColor: '#050510', fillOpacity: 0.85 }}
          />
        )}

        {/* 서울 구 경계선 렌더링 */}
        {districts.map((district) => {
          const isActive = district.id === currentDistrictId;
          // district.coords = [[lat, lng], ...] → Leaflet Polyline은 [[lat, lng]] 형식 그대로 사용
          const positions = district.coords; // [[lat, lng], ...]
          return (
            <Polyline
              key={district.id}
              positions={positions}
              pathOptions={{
                color: isActive ? '#ffd700' : '#4488ff',
                weight: isActive ? 2.5 : 1.2,
                opacity: isActive ? 1.0 : 0.65,
                dashArray: isActive ? null : '4 3',
              }}
            >
              <Tooltip
                permanent={false}
                direction="center"
                className="district-tooltip"
              >
                {district.name}
              </Tooltip>
            </Polyline>
          );
        })}

        <MapController center={mapCenter} zoom={zoomLevel} />
      </MapContainer>
    </div>
  );
};

export default LeafletMapBackground;
