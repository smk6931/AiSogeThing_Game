import React from 'react';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const GOLD = '#c8a84b';
const PANEL_BG = 'rgba(8, 14, 22, 0.9)';
const BORDER_ON = 'rgba(112, 181, 171, 0.56)';
const BORDER_OFF = 'rgba(100, 100, 100, 0.35)';
const GLOW = '0 0 16px rgba(103, 232, 214, 0.18)';
const ACCENT = '#67e8d6';

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

const BUTTONS = [
  { key: 'showOsmMap', label: '지도', icon: '🗺', colorOn: 'rgba(30,80,160,0.7)' },
  { key: 'showGroundMesh', label: '바닥', icon: '🎨', colorOn: 'rgba(50,150,50,0.7)' },
  { key: 'showSeoulRoads', label: '도로', icon: '🛣', colorOn: 'rgba(255,100,0,0.7)' },
  { key: 'showSeoulNature', label: '지형', icon: '🌲', colorOn: 'rgba(30,120,50,0.7)' },
  { key: 'showLanduseTextureLayer', label: '용도', icon: '🧱', colorOn: 'rgba(100,80,180,0.7)' },
  { key: 'showRoadSplitLayer', label: '분할', icon: '🧩', colorOn: 'rgba(150,90,200,0.7)' },
  { key: 'showLanduseZones', label: '용도구역', icon: '◆', colorOn: 'rgba(200,80,120,0.7)' },
  { key: 'showDistrictBoundaries', label: '경계', icon: '🏛', colorOn: 'rgba(0,180,200,0.7)' },
  { key: 'showGroupBoundaries', label: '그룹선', icon: '⬒', colorOn: 'rgba(0,210,220,0.7)' },
  { key: 'showMicroBoundaries', label: '미세선', icon: '┼', colorOn: 'rgba(240,190,90,0.7)' },
  { key: 'highlightCurrentGroup', label: '현재강조', icon: '✦', colorOn: 'rgba(80,220,180,0.7)' },
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
  showMicroBoundaries, setShowMicroBoundaries,
  showGroupBoundaries, setShowGroupBoundaries,
  highlightCurrentGroup, setHighlightCurrentGroup,
  cameraMode, setCameraMode, onPlayView,
  moveSpeed = 20, setMoveSpeed,
  isMobile = false
}) => {
  const [isLandusePanelOpen, setIsLandusePanelOpen] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  const toggleLanduse = (nextValue) => {
    const next = typeof nextValue === 'boolean' ? nextValue : !showLanduseZones;
    setShowLanduseZones(next);
    setIsLandusePanelOpen(next);
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
    showMicroBoundaries: { value: showMicroBoundaries, setter: setShowMicroBoundaries },
    showGroupBoundaries: { value: showGroupBoundaries, setter: setShowGroupBoundaries },
    highlightCurrentGroup: { value: highlightCurrentGroup, setter: setHighlightCurrentGroup },
  };

  const getBtnStyle = (isOn, colorOn, mobile = false) => ({
    padding: mobile ? '9px 10px' : '6px 10px',
    background: isOn ? colorOn : PANEL_BG,
    color: isOn ? '#fff' : '#8f8f96',
    border: `1px solid ${isOn ? BORDER_ON : BORDER_OFF}`,
    borderRadius: mobile ? '10px' : '6px',
    cursor: 'pointer',
    fontSize: mobile ? '12px' : '11px',
    fontWeight: '600',
    fontFamily: GAME_FONT,
    letterSpacing: '0.3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
    boxShadow: isOn ? GLOW : 'none',
    transform: isOn ? 'translateY(-1px)' : 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    width: mobile ? '100%' : 'auto',
  });

  const renderLanduseFilterPanel = (mobile = false) => (
    <div style={{
      position: mobile ? 'relative' : 'absolute',
      top: mobile ? 'auto' : '100%',
      left: 0,
      marginTop: mobile ? '8px' : '6px',
      background: 'rgba(10, 10, 18, 0.96)',
      border: `1px solid ${BORDER_OFF}`,
      borderRadius: '10px',
      padding: mobile ? '12px' : '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: mobile ? '100%' : '170px',
      backdropFilter: 'blur(14px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      maxHeight: mobile ? '240px' : '60vh',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
        <button
          onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '11px',
            background: 'rgba(80,160,80,0.3)', color: '#aeffae',
            border: '1px solid rgba(80,160,80,0.5)', borderRadius: '6px',
            cursor: 'pointer', fontFamily: GAME_FONT,
          }}
        >전체 ON</button>
        <button
          onClick={() => setLanduseFilters(Object.keys(landuseFilters).reduce((acc, k) => ({ ...acc, [k]: false }), {}))}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '11px',
            background: 'rgba(160,60,60,0.3)', color: '#ffaaaa',
            border: '1px solid rgba(160,60,60,0.5)', borderRadius: '6px',
            cursor: 'pointer', fontFamily: GAME_FONT,
          }}
        >전체 OFF</button>
      </div>

      {Object.entries(LANDUSE_LABELS).map(([fKey, { label: fLabel, color: fColor }]) => (
        <label key={fKey} style={{
          fontSize: mobile ? '12px' : '11px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: landuseFilters[fKey] ? '#eee' : '#666',
          transition: 'color 0.15s',
          fontFamily: GAME_FONT,
          gap: '8px',
        }}>
          <input
            type="checkbox"
            checked={!!landuseFilters[fKey]}
            onChange={() => setLanduseFilters(prev => ({ ...prev, [fKey]: !prev[fKey] }))}
            style={{ accentColor: fColor }}
          />
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: fColor, display: 'inline-block', flexShrink: 0,
          }} />
          {fLabel}
        </label>
      ))}

      <button
        onClick={() => setIsLandusePanelOpen(false)}
        style={{
          marginTop: '4px', padding: '7px', fontSize: '11px',
          background: 'rgba(100,100,100,0.3)', color: '#bbb',
          border: '1px solid rgba(100,100,100,0.4)', borderRadius: '6px',
          cursor: 'pointer', fontFamily: GAME_FONT,
        }}
      >필터 닫기</button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileDrawerOpen(prev => !prev)}
          style={{
            position: 'absolute',
            top: 'max(10px, env(safe-area-inset-top))',
            right: 'calc(max(10px, env(safe-area-inset-right)) + 104px)',
            zIndex: 140,
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: `1px solid ${isMobileDrawerOpen ? BORDER_ON : 'rgba(100,100,100,0.4)'}`,
            background: isMobileDrawerOpen ? 'rgba(19,50,60,0.95)' : 'rgba(6, 14, 22, 0.88)',
            color: isMobileDrawerOpen ? ACCENT : '#8fb2ad',
            fontFamily: GAME_FONT,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isMobileDrawerOpen ? GLOW : 'none',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
          }}
          title="레이어 패널"
        >
          ⚙
        </button>

        {isMobileDrawerOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(max(10px, env(safe-area-inset-top)) + 40px)',
            right: 'calc(max(10px, env(safe-area-inset-right)) + 104px)',
            zIndex: 141,
            width: '180px',
            maxHeight: '44vh',
            overflowY: 'auto',
            background: 'rgba(6, 14, 22, 0.96)',
            border: `1px solid ${BORDER_ON}`,
            borderRadius: '12px',
            padding: '8px',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '7px',
            }}>
              <div style={{ color: GOLD, fontSize: '11px', fontWeight: '700' }}>Mirror Layers</div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#b7d8d2', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {BUTTONS.map(({ key, label, icon, colorOn }) => {
                const isOn = stateMap[key].value;
                return (
                  <div key={key} style={{ gridColumn: key === 'showLanduseZones' ? '1 / -1' : 'auto' }}>
                    <button
                      onClick={() => {
                        const currentSetter = stateMap[key].setter;
                        if (key === 'showLanduseZones') {
                          currentSetter(!isOn);
                          return;
                        }
                        currentSetter(prev => !prev);
                      }}
                      style={{
                        ...getBtnStyle(isOn, colorOn, true),
                        padding: '5px 7px',
                        fontSize: '10px',
                        borderRadius: '7px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px' }}>{icon}</span>
                        <span>{label}</span>
                      </span>
                      <span style={{ fontSize: '9px', color: isOn ? '#a7fff2' : '#6e6e76' }}>
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                    </button>
                    {key === 'showLanduseZones' && isOn && isLandusePanelOpen && renderLanduseFilterPanel(true)}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '7px' }}>
              <button
                onClick={() => setCameraMode(prev => prev === 'isometric' ? '360' : 'isometric')}
                style={{
                  ...getBtnStyle(true, cameraMode === 'isometric' ? 'rgba(140,50,50,0.7)' : 'rgba(50,50,140,0.7)', true),
                  padding: '5px 7px', fontSize: '10px', borderRadius: '7px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px' }}>🎥</span>
                  <span>{cameraMode === 'isometric' ? '쿼터뷰' : '360도'}</span>
                </span>
              </button>
              <button
                onClick={onPlayView}
                style={{
                  ...getBtnStyle(true, 'rgba(212, 175, 55, 0.6)', true),
                  padding: '5px 7px', fontSize: '10px', borderRadius: '7px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px' }}>🎮</span>
                  <span>플레이뷰</span>
                </span>
              </button>
            </div>

          </div>
        )}
      </>
    );
  }

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
      {BUTTONS.map(({ key, label, icon, colorOn }) => {
        const isOn = stateMap[key].value;
        const isLanduseBtn = key === 'showLanduseZones';

        return (
          <div key={key} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (isLanduseBtn) {
                  toggleLanduse(!isOn);
                  return;
                }
                stateMap[key].setter(prev => !prev);
              }}
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

            {isLanduseBtn && isOn && isLandusePanelOpen && landuseFilters && renderLanduseFilterPanel(false)}
          </div>
        );
      })}

      <button
        onClick={() => setCameraMode(prev => prev === 'isometric' ? '360' : 'isometric')}
        style={getBtnStyle(true, cameraMode === 'isometric' ? 'rgba(140,50,50,0.7)' : 'rgba(50,50,140,0.7)')}
      >
        <span style={{ fontSize: '13px' }}>🎥</span>
        <span>{cameraMode === 'isometric' ? '쿼터뷰' : '360도'}</span>
      </button>

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
