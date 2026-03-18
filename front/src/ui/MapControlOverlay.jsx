import React from 'react';

/**
 * MapControlOverlay - 지도 레이어 토글 컨트롤
 *
 * 리펙토링 후 구성:
 * - 지도(OSM 타일), 도로 동선, 자연 지형, 블록 텍스처
 * - 용도 구역 (세부 필터 드롭다운 포함)
 * - 구 경계 (포스필드)
 * - 시점 전환 (쿼터뷰/360)
 *
 * [제거됨] 등고선(HeightMap) — 코드는 보존, UI 버튼만 제거
 */

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const GOLD = '#c8a84b';
const PANEL_BG = 'rgba(8, 8, 16, 0.85)';
const BORDER_ON = 'rgba(180, 140, 60, 0.6)';
const BORDER_OFF = 'rgba(100, 100, 100, 0.35)';
const GLOW = '0 0 12px rgba(200, 168, 75, 0.25)';

// 용도 구역 세부 필터 목록
const LANDUSE_LABELS = {
  residential: { label: '주거지역', color: '#8bc34a' },
  commercial: { label: '상업시설', color: '#2196f3' },
  industrial: { label: '공업구역', color: '#ffc107' },
  institutional: { label: '공공기관', color: '#9c27b0' },
  educational: { label: '교육시설', color: '#ff5722' },
  medical: { label: '의료시설', color: '#f44336' },
  parking: { label: '주차공간', color: '#9e9e9e' },
  natural_site: { label: '자연지', color: '#c5e1a5' },
  military: { label: '군사시설', color: '#795548' },
  religious: { label: '종교시설', color: '#e91e63' },
  sports: { label: '스포츠', color: '#00bcd4' },
  cemetery: { label: '묘지', color: '#607d8b' },
  transport: { label: '교통', color: '#455a64' },
  port: { label: '항구', color: '#1a237e' },
  unexplored: { label: '미개척', color: '#4a3728' },
};

// 토글 버튼 정의 (등고선 제거됨)
const BUTTONS = [
  { key: 'showOsmMap', label: '지도', icon: '🗺', colorOn: 'rgba(30,80,160,0.7)' },
  { key: 'showGroundMesh', label: '바닥 채우기', icon: '🎨', colorOn: 'rgba(50,150,50,0.7)' },
  { key: 'showSeoulRoads', label: '도로', icon: '🛣', colorOn: 'rgba(255,100,0,0.7)' },
  { key: 'showSeoulNature', label: '지형', icon: '🌲', colorOn: 'rgba(30,120,50,0.7)' },
  { key: 'showLanduseTextureLayer', label: '용도텍스처', icon: '🧱', colorOn: 'rgba(100,80,180,0.7)' },
  { key: 'showRoadSplitLayer', label: '도로분할블록', icon: '🧩', colorOn: 'rgba(150,90,200,0.7)' },
  { key: 'showLanduseZones', label: '용도구역', icon: '◆', colorOn: 'rgba(200,80,120,0.7)' },
  { key: 'showDistrictBoundaries', label: '경계', icon: '🏛', colorOn: 'rgba(0,180,200,0.7)' },
];

const MapControlOverlay = ({
  showOsmMap, setShowOsmMap,
  showSeoulRoads, setShowSeoulRoads,
  showSeoulNature, setShowSeoulNature,
  showLanduseTextureLayer, setShowLanduseTextureLayer,
  showRoadSplitLayer, setShowRoadSplitLayer,
  showLanduseZones, setShowLanduseZones,
  landuseFilters, setLanduseFilters,
  showGroundMesh, setShowGroundMesh,
  showDistrictBoundaries, setShowDistrictBoundaries,
  cameraMode, setCameraMode, onPlayView
  // showHeightMap, setShowHeightMap 은 UI에서 제거 (코드 보존)
}) => {
  const [isLandusePanelOpen, setIsLandusePanelOpen] = React.useState(false);

  const toggleLanduse = () => {
    const next = !showLanduseZones;
    setShowLanduseZones(next);
    if (next) setIsLandusePanelOpen(true);
    else setIsLandusePanelOpen(false);
  };

  const stateMap = {
    showOsmMap: { value: showOsmMap, setter: setShowOsmMap },
    showGroundMesh: { value: showGroundMesh, setter: setShowGroundMesh },
    showSeoulRoads: { value: showSeoulRoads, setter: setShowSeoulRoads },
    showSeoulNature: { value: showSeoulNature, setter: setShowSeoulNature },
    showLanduseTextureLayer: { value: showLanduseTextureLayer, setter: setShowLanduseTextureLayer },
    showRoadSplitLayer: { value: showRoadSplitLayer, setter: setShowRoadSplitLayer },
    showLanduseZones: { value: showLanduseZones, setter: toggleLanduse },
    showDistrictBoundaries: { value: showDistrictBoundaries, setter: setShowDistrictBoundaries },
  };

  // 공통 버튼 스타일 생성
  const getBtnStyle = (isOn, colorOn) => ({
    padding: '6px 10px',
    background: isOn ? colorOn : PANEL_BG,
    color: isOn ? '#fff' : '#777',
    border: `1px solid ${isOn ? BORDER_ON : BORDER_OFF}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: GAME_FONT,
    letterSpacing: '0.3px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
    boxShadow: isOn ? GLOW : 'none',
    transform: isOn ? 'translateY(-1px)' : 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 170,
      zIndex: 100,
      display: 'flex',
      gap: '5px',
      flexWrap: 'wrap',
      maxWidth: 'calc(100vw - 360px)',
      fontFamily: GAME_FONT,
    }}>
      {/* 레이어 토글 버튼들 */}
      {BUTTONS.map(({ key, label, icon, colorOn }) => {
        const isOn = stateMap[key].value;
        const isLanduseBtn = key === 'showLanduseZones';

        return (
          <div key={key} style={{ position: 'relative' }}>
            <button
              onClick={() => stateMap[key].setter(prev => !prev)}
              style={getBtnStyle(isOn, colorOn)}
            >
              <span style={{ fontSize: '13px' }}>{icon}</span>
              <span>{label}</span>
              <span style={{
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '3px',
                background: isOn ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                color: isOn ? '#aeffae' : '#555',
                fontWeight: '700',
              }}>
                {isOn ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* 용도 구역 세부 필터 드롭다운 */}
            {isLanduseBtn && isOn && isLandusePanelOpen && landuseFilters && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                background: PANEL_BG,
                border: `1px solid ${BORDER_OFF}`,
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                minWidth: '170px',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                maxHeight: '60vh',
                overflowY: 'auto',
              }}>
                {/* 전체 ON/OFF */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <button
                    onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}
                    style={{
                      flex: 1, padding: '4px', fontSize: '10px',
                      background: 'rgba(80,160,80,0.3)', color: '#aeffae',
                      border: '1px solid rgba(80,160,80,0.5)', borderRadius: '4px',
                      cursor: 'pointer', fontFamily: GAME_FONT,
                    }}
                  >전체 ON</button>
                  <button
                    onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: false }), {}))}
                    style={{
                      flex: 1, padding: '4px', fontSize: '10px',
                      background: 'rgba(160,60,60,0.3)', color: '#ffaaaa',
                      border: '1px solid rgba(160,60,60,0.5)', borderRadius: '4px',
                      cursor: 'pointer', fontFamily: GAME_FONT,
                    }}
                  >전체 OFF</button>
                </div>

                {/* 카테고리 체크박스 */}
                {Object.entries(LANDUSE_LABELS).map(([fKey, { label: fLabel, color: fColor }]) => (
                  <label key={fKey} style={{
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: landuseFilters[fKey] ? '#eee' : '#666',
                    transition: 'color 0.15s',
                    fontFamily: GAME_FONT,
                    gap: '6px',
                  }}>
                    <input
                      type="checkbox"
                      checked={!!landuseFilters[fKey]}
                      onChange={() => setLanduseFilters(prev => ({ ...prev, [fKey]: !prev[fKey] }))}
                      style={{ marginRight: '2px', accentColor: fColor }}
                    />
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: fColor, display: 'inline-block', flexShrink: 0,
                    }} />
                    {fLabel}
                  </label>
                ))}

                {/* 닫기 */}
                <button
                  onClick={() => setIsLandusePanelOpen(false)}
                  style={{
                    marginTop: '4px', padding: '5px', fontSize: '10px',
                    background: 'rgba(100,100,100,0.3)', color: '#999',
                    border: '1px solid rgba(100,100,100,0.4)', borderRadius: '4px',
                    cursor: 'pointer', fontFamily: GAME_FONT,
                  }}
                >✕ 닫기</button>
              </div>
            )}
          </div>
        );
      })}

      {/* 시점 전환 버튼 */}
      <button
        onClick={() => setCameraMode(prev => prev === 'isometric' ? '360' : 'isometric')}
        style={getBtnStyle(true, cameraMode === 'isometric' ? 'rgba(140,50,50,0.7)' : 'rgba(50,50,140,0.7)')}
      >
        <span style={{ fontSize: '13px' }}>🎥</span>
        <span>{cameraMode === 'isometric' ? '쿼터뷰' : '360도'}</span>
      </button>

      {/* 뷰티샷/플레이 뷰 버튼 */}
      <button
        onClick={onPlayView}
        style={getBtnStyle(true, 'rgba(212, 175, 55, 0.6)')}
      >
        <span style={{ fontSize: '13px' }}>🎮</span>
        <span>플레이 뷰</span>
      </button>
    </div>
  );
};

export default MapControlOverlay;
