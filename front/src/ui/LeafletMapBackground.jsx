import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
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

// 맵 이벤트를 처리하는 서브 컴포넌트
const MapEvents = ({ onZoomChange }) => {
  const map = useMapEvents({
    zoomend: () => {
      if (onZoomChange) onZoomChange(map.getZoom());
    },
  });
  return null;
};

const LeafletMapBackground = ({
  playerPositionRef,
  zoomLevel,
  districts = [],
  dongs = [],
  currentDistrictId = null,
  currentDongId = null,
  interactive = false,
  showSeoulMask = true,
  onZoomChange = null

}) => {
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#f4f1ea' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        zoomControl={interactive}
        scrollWheelZoom={interactive}
        touchZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapEvents onZoomChange={onZoomChange} />
        <TileLayer
          url="https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />

        {/* 서울 외곽 어둡게 마스크 (미니맵 시야 제한용, 옵션으로 켜고 끔) */}
        {showSeoulMask && districts && districts.length > 0 && (
          <Polygon
            positions={[
              [[-90, -180], [90, -180], [90, 180], [-90, 180]], // 전 세계 박스
              ...districts.map(d => d.coords) // 서울 구역들 구멍(hole)으로 뚫림
            ]}
            pathOptions={{ color: 'transparent', fillColor: '#050510', fillOpacity: 0.75 }}
          />
        )}

        {/* 서울 구 경계선 렌더링 */}
        {districts.map((district) => {
          const isActive = district.id === currentDistrictId;
          return (
            <Polyline
              key={`dist-${district.id}`}
              positions={district.coords}
              pathOptions={{
                color: isActive ? '#ffd700' : '#4488ff',
                weight: isActive ? 2.5 : 1.2,
                opacity: isActive ? 1.0 : 0.65,
                dashArray: isActive ? null : '4 3',
                zIndex: isActive ? 1000 : 500
              }}
            />
          );
        })}

        {/* 서울 동 경계선 렌더링 (고도화) */}
        {dongs && dongs.map((dong) => {
          const isActive = dong.id === currentDongId;
          return (
            <Polyline
              key={`dong-${dong.id}`}
              positions={dong.coords}
              pathOptions={{
                color: isActive ? '#ffd700' : '#ffffff',
                weight: isActive ? 2.0 : 0.5,
                opacity: isActive ? 0.9 : 0.3,
                zIndex: isActive ? 1100 : 400
              }}
            />
          );
        })}


        <MapController center={mapCenter} zoom={zoomLevel} />
      </MapContainer>
    </div>
  );
};

export default LeafletMapBackground;
