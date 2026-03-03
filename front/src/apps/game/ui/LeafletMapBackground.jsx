import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '../world/mapConfig';

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

const LeafletMapBackground = ({ playerPositionRef, zoomLevel }) => {
  const LAT_PER_M = 1 / LAT_TO_M;
  const LNG_PER_M = 1 / LNG_TO_M;

  const [mapCenter, setMapCenter] = useState([GIS_ORIGIN.lat, GIS_ORIGIN.lng]);

  // [최적화] 매 프레임 리렌더링하지 않고 위치가 실질적으로 바뀌었을 때만 지도 중심 이동
  useEffect(() => {
    let animationFrameId;
    let lastMappedCenter = [GIS_ORIGIN.lat, GIS_ORIGIN.lng];

    const syncMap = () => {
      if (playerPositionRef && playerPositionRef.current) {
        const { x, z } = playerPositionRef.current;
        const lat = GIS_ORIGIN.lat - (z * LAT_PER_M);
        const lng = GIS_ORIGIN.lng + (x * LNG_PER_M);

        // 정밀도 최적화: 일정 이상 거리가 벌어졌을 때만 상태 업데이트 (성능 향상)
        const distSq = Math.pow(lat - lastMappedCenter[0], 2) + Math.pow(lng - lastMappedCenter[1], 2);
        if (distSq > 0.0000000001) {
          setMapCenter([lat, lng]);
          lastMappedCenter = [lat, lng];
        }
      }
      animationFrameId = requestAnimationFrame(syncMap);
    };

    syncMap();
    return () => cancelAnimationFrame(animationFrameId);
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

        <MapController center={mapCenter} zoom={zoomLevel} />
      </MapContainer>
    </div>
  );
};

export default LeafletMapBackground;
