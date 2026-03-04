import React, { useState, useEffect, useRef } from 'react';
import { Shield, Zap, Sword, Settings, Home, LogOut, Users, Flame } from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LeafletMapBackground from './LeafletMapBackground';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M, getAllMaps } from '@world/mapConfig';
import { useSeoulDistricts } from '@game-hooks/useSeoulDistricts';

// =============================
// 공통 가이드 & 유틸리티
// =============================
const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'rgba(8, 8, 16, 0.82)';
const BORDER_COLOR = 'rgba(180, 140, 60, 0.55)';
const GOLD = '#c8a84b';
const HIGHLIGHT = 'rgba(200, 168, 75, 0.12)';
const GLOW = '0 0 12px rgba(200, 168, 75, 0.25)';

const injectFont = () => {
  if (document.getElementById('game-font-link')) return;
  const link = document.createElement('link');
  link.id = 'game-font-link';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap';
  document.head.appendChild(link);
};

const GameOverlay = ({ myPositionRef, onSimulateKey, onlineCount = 0, myStats }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [gpsCoords, setGpsCoords] = useState({ lat: GIS_ORIGIN.lat, lng: GIS_ORIGIN.lng });
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [showZoneTitle, setShowZoneTitle] = useState(false);
  const lastDistrictRef = useRef('');

  // 서울 구 경계 데이터 로드 (최초 1회, 30일 로컬 캐시)
  const { districts, getDistrictAt } = useSeoulDistricts();

  // 실시간 GPS 및 구역 추적
  useEffect(() => {
    let frameId;
    const updateGps = () => {
      if (myPositionRef && myPositionRef.current) {
        const { x, z } = myPositionRef.current;
        const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
        const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);
        setGpsCoords({ lat, lng });

        // 실제 서울 구 경계 폴리곤 기반 판별
        if (getDistrictAt) {
          const found = getDistrictAt(lat, lng);
          const distName = found ? found.name : null;
          if (distName && distName !== lastDistrictRef.current) {
            setCurrentDistrict(found);
            lastDistrictRef.current = distName;
            setShowZoneTitle(true);
            setTimeout(() => setShowZoneTitle(false), 3000);
          }
        }
      }
      frameId = requestAnimationFrame(updateGps);
    };
    updateGps();
    return () => cancelAnimationFrame(frameId);
  }, [myPositionRef, getDistrictAt]);

  // 초기화 및 글로벌 스타일 주입
  useEffect(() => {
    injectFont();
    const styleId = 'game-overlay-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          15% { opacity: 1; transform: translate(-50%, -50%); }
          85% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, -60%); }
        }
      `;
      document.head.appendChild(style);
    }
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const playerStats = {
    hp: myStats?.hp || 100,
    maxHp: myStats?.maxHp || 100,
    mp: myStats?.mp || 50,
    maxMp: myStats?.maxMp || 50,
    level: myStats?.level || 1,
    nickname: user?.nickname || 'Guest'
  };

  const hpPct = Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (playerStats.mp / playerStats.maxMp) * 100));

  const skills = [
    { key: 'Q', icon: Sword, label: '베기', cooldown: 0 },
    { key: 'W', icon: Shield, label: '방어', cooldown: 2 },
    { key: 'E', icon: Zap, label: '번개', cooldown: 0 },
    { key: 'R', icon: Flame, label: '펀치', cooldown: 10 },
  ];

  const items = [
    { key: '1', name: 'Potion', count: 5, icon: '🧪' },
    { key: '2', name: 'Mana', count: 3, icon: '💧' },
    { key: '3', name: '', count: 0, icon: '' },
    { key: '4', name: '', count: 0, icon: '' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 50,
      fontFamily: GAME_FONT
    }}>
      {/* 1. 상태창 */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 'max(10px, env(safe-area-inset-top))' : '18px',
        left: isMobile ? 'max(10px, env(safe-area-inset-left))' : '18px',
        width: isMobile ? '155px' : '260px',
        padding: '12px',
        borderRadius: '10px',
        background: PANEL_BG,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER_COLOR}`,
        boxShadow: GLOW,
        pointerEvents: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            background: `linear-gradient(135deg, #b8860b, ${GOLD})`,
            color: '#1a1000', fontWeight: 'bold',
            borderRadius: '50%', width: isMobile ? '22px' : '28px',
            height: isMobile ? '22px' : '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? '11px' : '13px'
          }}>{playerStats.level}</div>
          <span style={{ color: GOLD, fontWeight: '600', fontSize: isMobile ? '13px' : '15px' }}>{playerStats.nickname}</span>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa' }}>
            <span style={{ color: '#ff6b6b' }}>HP</span>
            <span>{playerStats.hp}/{playerStats.maxHp}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${hpPct}%`, height: '100%', background: 'linear-gradient(90deg, #b91c1c, #ef4444)', transition: 'width 0.3s' }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa' }}>
            <span style={{ color: '#60a5fa' }}>MP</span>
            <span>{playerStats.mp}/{playerStats.maxMp}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${mpPct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* 2. 미니맵 */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 'max(10px, env(safe-area-inset-top))' : '18px',
        right: isMobile ? 'max(10px, env(safe-area-inset-right))' : '20px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px'
      }}>
        {!isMapExpanded && (
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            border: `1px solid ${currentDistrict?.name?.includes('동작') ? '#4ade80' : BORDER_COLOR}`,
            borderRadius: '15px',
            padding: '2px 14px',
            color: currentDistrict?.name?.includes('동작') ? '#4ade80' : '#fff',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: currentDistrict?.name?.includes('동작') ? '0 0 10px rgba(74, 222, 128, 0.4)' : 'none'
          }}>
            <Flame size={12} color={currentDistrict?.name?.includes('동작') ? '#4ade80' : "#ff6b6b"} />
            {currentDistrict?.name || 'SEOUL'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'auto' }}>
            <button onClick={() => setMapZoom(z => Math.min(z + 1, 19))} style={{ width: '28px', height: '28px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: GOLD, cursor: 'pointer' }}>+</button>
            <button onClick={() => setMapZoom(z => Math.max(z - 1, 10))} style={{ width: '28px', height: '28px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: GOLD, cursor: 'pointer' }}>-</button>
          </div>
          <div style={{
            position: 'relative', width: isMobile ? '88px' : '136px', height: isMobile ? '88px' : '136px',
            background: PANEL_BG, borderRadius: '50%', border: `2px solid ${BORDER_COLOR}`,
            overflow: 'hidden', pointerEvents: 'auto', cursor: 'pointer'
          }} onClick={() => setIsMapExpanded(true)}>
            <div style={{ position: 'absolute', inset: -5, opacity: 0.85 }}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom}
                districts={districts}
                currentDistrictId={currentDistrict?.id || null}
              />
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 10px #4ade80', zIndex: 10 }} />
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '10px', zIndex: 11 }}>
              <Users size={10} color={GOLD} /> {onlineCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 월드맵 확장 모달 */}
      {isMapExpanded && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
          <div style={{ width: '80vw', height: '70vh', background: PANEL_BG, borderRadius: '16px', border: `2px solid ${BORDER_COLOR}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom + 1}
                districts={districts}
                currentDistrictId={currentDistrict?.id || null}
              />
            </div>
            <div style={{ position: 'absolute', top: '16px', right: '16px', color: '#ff4444', fontSize: '24px', cursor: 'pointer', zIndex: 10 }} onClick={() => setIsMapExpanded(false)}>✕</div>
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '8px', color: '#4ade80', zIndex: 10 }}>
              <div style={{ fontSize: '10px', color: '#aaa' }}>GPS TRACKING</div>
              <div style={{ fontSize: '14px' }}>LAT: {gpsCoords.lat.toFixed(6)}\u00B0 / LNG: {gpsCoords.lng.toFixed(6)}\u00B0</div>
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '12px', height: '12px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 15px #4ade80', zIndex: 10 }} />
          </div>
        </div>
      )}

      {/* 4. 액션바 */}
      <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: isMobile ? 'none' : 'flex', gap: '12px', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {skills.map((s, i) => (
            <div key={i} style={{ width: '60px', height: '60px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', top: '4px', left: '6px', fontSize: '10px', color: GOLD }}>{s.key}</span>
              <s.icon size={24} color="#fff" />
              {s.cooldown > 0 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>{s.cooldown}</div>}
            </div>
          ))}
        </div>
        <div style={{ width: '1px', height: '60px', background: BORDER_COLOR, opacity: 0.5 }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ width: '50px', height: '50px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#888' }}>{it.key}</span>
              {it.icon}
              {it.count > 0 && <span style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '10px', color: GOLD, fontWeight: 'bold' }}>{it.count}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 5. 모바일 공격 */}
      {isMobile && (
        <div onClick={() => onSimulateKey('r', true)} style={{ position: 'absolute', bottom: '40px', right: '25px', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', pointerEvents: 'auto' }}>👊</div>
      )}

      {/* 6. 구역 진입 타이틀 */}
      {showZoneTitle && (
        <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeInOut 3s forwards', pointerEvents: 'none' }}>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '4px' }}>NOW ENTERING</div>
          <div style={{ color: '#fff', fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', letterSpacing: '2px' }}>{currentDistrict?.name || ''}</div>
          {currentDistrict?.name_en && <div style={{ color: '#aaa', fontSize: '18px', marginTop: '4px' }}>{currentDistrict.name_en}</div>}
          <div style={{ width: '200px', height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: '10px' }} />
        </div>
      )}

      {/* 설정 버튼 */}
      <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ position: 'absolute', top: isMobile ? '100px' : '170px', right: isMobile ? '10px' : '20px', width: '32px', height: '32px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto' }}>
        <Settings size={16} color={GOLD} />
      </div>

      {isMenuOpen && (
        <div style={{ position: 'absolute', top: isMobile ? '140px' : '210px', right: isMobile ? '10px' : '20px', background: PANEL_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px', padding: '8px', zIndex: 100, pointerEvents: 'auto', minWidth: '120px' }}>
          <div onClick={() => navigate('/')} style={{ color: GOLD, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Home size={14} /> 홈으로</div>
          <div onClick={() => navigate('/')} style={{ color: '#ef4444', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><LogOut size={14} /> 나가기</div>
        </div>
      )}

    </div>
  );
};

export default GameOverlay;
