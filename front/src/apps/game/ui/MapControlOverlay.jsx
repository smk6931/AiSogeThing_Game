import React from 'react';

/**
 * 지도 레이어 토글 컨트롤 오버레이
 * 게임 테마(Gold Border + Glassmorphism)와 일관된 디자인 적용
 */
const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const GOLD = '#c8a84b';
const PANEL_BG = 'rgba(8, 8, 16, 0.82)';
const BORDER_ON = 'rgba(180, 140, 60, 0.6)';
const BORDER_OFF = 'rgba(100, 100, 100, 0.35)';
const GLOW = '0 0 12px rgba(200, 168, 75, 0.2)';

const BUTTONS = [
  { key: 'showOsmMap', label: '지도', icon: '🗺', colorOn: 'rgba(30,80,160,0.7)' },
  { key: 'showSeoulRoads', label: '도로 동선', icon: '🛣️', colorOn: 'rgba(255,100,0,0.7)' },
  { key: 'showSeoulNature', label: '자연 지형', icon: '🌲', colorOn: 'rgba(30,120,50,0.7)' },
  { key: 'showCityBlocks', label: '블록 텍스처', icon: '🏙️', colorOn: 'rgba(120,60,160,0.7)' },
  { key: 'showLanduseZones', label: '용도 구역', icon: '🏷️', colorOn: 'rgba(200,80,120,0.7)' },
  { key: 'showHeightMap', label: '등고선', icon: '⛰', colorOn: 'rgba(160,100,30,0.7)' },
  { key: 'showDistrictBoundaries', label: '구 경계', icon: '🏛️', colorOn: 'rgba(0,180,200,0.7)' },
];

const MapControlOverlay = ({
  showOsmMap, setShowOsmMap,
  showSeoulRoads, setShowSeoulRoads,
  showSeoulNature, setShowSeoulNature,
  showCityBlocks, setShowCityBlocks,
  showLanduseZones, setShowLanduseZones,
  landuseFilters, setLanduseFilters,
  showHeightMap, setShowHeightMap,
  showDistrictBoundaries, setShowDistrictBoundaries,
  cameraMode, setCameraMode,
}) => {
  const stateMap = {
    showOsmMap: { value: showOsmMap, setter: setShowOsmMap },
    showSeoulRoads: { value: showSeoulRoads, setter: setShowSeoulRoads },
    showSeoulNature: { value: showSeoulNature, setter: setShowSeoulNature },
    showCityBlocks: { value: showCityBlocks, setter: setShowCityBlocks },
    showLanduseZones: { value: showLanduseZones, setter: setShowLanduseZones },
    showHeightMap: { value: showHeightMap, setter: setShowHeightMap },
    showDistrictBoundaries: { value: showDistrictBoundaries, setter: setShowDistrictBoundaries },
  };

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 180,
      zIndex: 100,
      display: 'flex',
      gap: '8px',
      fontFamily: GAME_FONT,
    }}>
      {BUTTONS.map(({ key, label, icon, colorOn }) => {
        const isOn = stateMap[key].value;
        const isLanduseBtn = key === 'showLanduseZones';
        return (
          <div key={key} style={{ position: 'relative' }}>
            <button
              onClick={() => stateMap[key].setter(prev => !prev)}
              style={{
                padding: '7px 13px',
                background: isOn ? colorOn : PANEL_BG,
                color: isOn ? '#fff' : '#888',
                border: `1px solid ${isOn ? BORDER_ON : BORDER_OFF}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: GAME_FONT,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(12px)',
                boxShadow: isOn ? GLOW : 'none',
                transform: isOn ? 'translateY(-1px)' : 'translateY(0)',
                userSelect: 'none',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
              <span style={{
                fontSize: '10px',
                color: isOn ? '#aeffae' : '#666',
                marginLeft: '2px',
                fontWeight: '700',
              }}>
                {isOn ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* 용도 구역 세부 필터 드롭다운 패널 */}
            {isLanduseBtn && isOn && landuseFilters && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                background: PANEL_BG, border: `1px solid ${BORDER_OFF}`,
                borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column',
                gap: '8px', minWidth: '160px', backdropFilter: 'blur(14px)', boxShadow: '0 4px 12px rgba(0,0,0,0.7)'
              }}>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '4px' }}>
                  <button onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}
                    style={{ flex: 1, padding: '5px', fontSize: '11px', background: 'rgba(50,50,50,0.8)', color: '#fff', border: `1px solid ${BORDER_OFF}`, borderRadius: '4px', cursor: 'pointer', fontFamily: GAME_FONT }}>전체 켜기</button>
                  <button onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: false }), {}))}
                    style={{ flex: 1, padding: '5px', fontSize: '11px', background: 'rgba(50,50,50,0.8)', color: '#fff', border: `1px solid ${BORDER_OFF}`, borderRadius: '4px', cursor: 'pointer', fontFamily: GAME_FONT }}>전체 끄기</button>
                </div>
                {Object.entries({
                  residential: '가옥/거주 (초록)', commercial: '상업시설 (파랑)', industrial: '공업/건설 (노랑)',
                  institutional: '공공기관 (보라)', educational: '교육시설 (주홍)', medical: '의료병원 (빨강)',
                  parking: '주차공간 (회색)', natural_site: '비개발/자연지 (연녹)',
                  military: '군사시설 (갈색)', religious: '종교시설 (핑크)', sports: '스포츠시설 (하늘)',
                  cemetery: '공동묘지 (청회)', transport: '교통/공항 (다크)', port: '항구/부두 (남색)',
                  unexplored: '🗺 미개척 지형 (다크브라운)'
                }).map(([fKey, fLabel]) => (
                  <label key={fKey} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: landuseFilters[fKey] ? '#fff' : '#aaa', transition: 'color 0.2s', fontFamily: GAME_FONT }}>
                    <input type="checkbox" checked={!!landuseFilters[fKey]} style={{ marginRight: '8px', accentColor: GOLD }}
                      onChange={() => setLanduseFilters(prev => ({ ...prev, [fKey]: !prev[fKey] }))} />
                    {fLabel}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Camera Mode Toggle Button */}
      <button
        onClick={() => setCameraMode(prev => prev === 'isometric' ? '360' : 'isometric')}
        style={{
          padding: '7px 13px',
          background: cameraMode === 'isometric' ? 'rgba(160,50,50,0.7)' : 'rgba(50,50,160,0.7)',
          color: '#fff',
          border: `1px solid ${BORDER_ON}`,
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          fontFamily: GAME_FONT,
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(12px)',
          boxShadow: GLOW,
          userSelect: 'none',
        }}
      >
        <span>🎥</span>
        <span>시점: {cameraMode === 'isometric' ? '쿼터뷰' : '360도'}</span>
      </button>
    </div>
  );
};

export default MapControlOverlay;
