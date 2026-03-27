import React, { useState, useEffect, useRef } from 'react';
import { Shield, Zap, Sword, Settings, Home, LogOut, Users, Flame } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LeafletMapBackground from './LeafletMapBackground';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M, getAllMaps } from '@entity/world/mapConfig';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';

// =============================
// 공통 가이드 & 유틸리티
// =============================
const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'linear-gradient(180deg, rgba(14, 20, 28, 0.88), rgba(8, 10, 16, 0.86))';
const BORDER_COLOR = 'rgba(124, 171, 166, 0.45)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';
const GLOW = '0 0 18px rgba(103, 232, 214, 0.18)';

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

  // 서울 구/동 경계 데이터 로드
  const { districts, getDistrictAt } = useSeoulDistricts();
  const { dongs, getDongAt } = useSeoulDongs();

  const [currentDong, setCurrentDong] = useState(null);
  const lastDongRef = useRef('');

  // 실시간 GPS 및 구역 추적 (성능 최적화를 위해 500ms 주기로 샘플링)
  useEffect(() => {
    const updateGps = () => {
      if (myPositionRef && myPositionRef.current) {
        const { x, z } = myPositionRef.current;
        const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
        const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);

        // 1. GPS 위치 업데이트 (지도의 중심)
        setGpsCoords({ lat, lng });

        // 2. 실제 서울 구/동 경계 폴리곤 기반 판별
        if (getDistrictAt) {
          const foundDist = getDistrictAt(lat, lng);
          const distName = foundDist ? foundDist.name : null;
          if (distName && distName !== lastDistrictRef.current) {
            setCurrentDistrict(foundDist);
            lastDistrictRef.current = distName;
            setShowZoneTitle(true);
            setTimeout(() => setShowZoneTitle(false), 3000);
          }
        }

        if (getDongAt) {
          const foundDong = getDongAt(lat, lng);
          const dongName = foundDong ? foundDong.name : null;
          if (dongName && dongName !== lastDongRef.current) {
            setCurrentDong(foundDong);
            lastDongRef.current = dongName;
          }
        }
      }
    };

    const interval = setInterval(updateGps, 500);
    return () => clearInterval(interval);
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
        width: isMobile ? '148px' : '260px',
        padding: isMobile ? '10px' : '12px',
        borderRadius: '14px',
        background: PANEL_BG,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER_COLOR}`,
        boxShadow: GLOW,
        pointerEvents: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT}, ${GOLD})`,
            color: '#081015', fontWeight: 'bold',
            borderRadius: '50%', width: isMobile ? '22px' : '28px',
            height: isMobile ? '22px' : '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? '11px' : '13px'
          }}>{playerStats.level}</div>
          <span style={{ color: GOLD, fontWeight: '700', fontSize: isMobile ? '12px' : '15px', letterSpacing: '0.3px' }}>{playerStats.nickname}</span>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '11px', color: '#aaa' }}>
            <span style={{ color: '#ff6b6b' }}>HP</span>
            <span>{playerStats.hp}/{playerStats.maxHp}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${hpPct}%`, height: '100%', background: 'linear-gradient(90deg, #b91c1c, #ef4444)', transition: 'width 0.3s' }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '11px', color: '#aaa' }}>
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
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          pointerEvents: 'auto'
        }}>
          <div style={{
            position: 'relative', width: isMobile ? '94px' : '136px', height: isMobile ? '94px' : '136px',
            background: PANEL_BG, borderRadius: '50%', border: `2px solid ${BORDER_COLOR}`,
            overflow: 'hidden', pointerEvents: 'auto', cursor: 'pointer',
            boxShadow: GLOW
          }} onClick={() => setIsMapExpanded(true)}>
            <div style={{ position: 'absolute', inset: -5, opacity: 0.85 }}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom}
                districts={districts}
                dongs={dongs}
                currentDistrictId={currentDistrict?.id || null}
                currentDongId={currentDong?.id || null}
              />
            </div>

            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', background: ACCENT, borderRadius: '50%', boxShadow: `0 0 10px ${ACCENT}`, zIndex: 10 }} />
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#dffdfa', background: 'rgba(4,12,18,0.72)', padding: '2px 8px', borderRadius: '10px', zIndex: 11, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={10} color={GOLD} /> {onlineCount}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={() => setMapZoom(z => Math.min(z + 1, 19))} style={{ width: '28px', height: '28px', background: 'rgba(10,18,26,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: ACCENT, cursor: 'pointer' }}>+</button>
            <button onClick={() => setMapZoom(z => Math.max(z - 1, 10))} style={{ width: '28px', height: '28px', background: 'rgba(10,18,26,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: ACCENT, cursor: 'pointer' }}>-</button>
          </div>
        </div>

        {!isMapExpanded && (
          <div style={{
            background: 'rgba(6,12,18,0.82)',
            border: `1px solid ${currentDistrict?.name?.includes('동작') ? ACCENT : BORDER_COLOR}`,
            borderRadius: '999px',
            padding: isMobile ? '4px 12px' : '4px 14px',
            color: currentDistrict?.name?.includes('동작') ? ACCENT : '#e8f7f4',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: currentDistrict?.name?.includes('동작') ? '0 0 12px rgba(103, 232, 214, 0.22)' : 'none'
          }}>
            <Flame size={12} color={currentDistrict?.name?.includes('동작') ? ACCENT : GOLD} />
            {currentDistrict?.name || 'SEOUL'}
          </div>
        )}
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
                dongs={dongs}
                currentDistrictId={currentDistrict?.id || null}
                currentDongId={currentDong?.id || null}
                interactive={true}
                showSeoulMask={true}
                onZoomChange={(newZoom) => setMapZoom(newZoom - 1)}
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
        <div onClick={() => onSimulateKey('r', true)} style={{ position: 'absolute', bottom: '40px', right: '25px', width: '64px', height: '64px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(255,120,120,0.95), rgba(220,38,38,0.82))', border: '1px solid rgba(255,210,180,0.32)', boxShadow: '0 10px 24px rgba(220,38,38,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', pointerEvents: 'auto' }}>👊</div>
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
      <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ position: 'absolute', top: isMobile ? '150px' : '170px', right: isMobile ? '10px' : '20px', width: '32px', height: '32px', background: 'rgba(8,14,22,0.88)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', boxShadow: GLOW }}>
        <Settings size={16} color={GOLD} />
      </div>

      {isMenuOpen && (
        <div style={{ position: 'absolute', top: isMobile ? '190px' : '210px', right: isMobile ? '10px' : '20px', background: 'rgba(8,14,22,0.94)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '12px', padding: '8px', zIndex: 100, pointerEvents: 'auto', minWidth: '120px', boxShadow: GLOW }}>
          <div onClick={() => navigate('/')} style={{ color: GOLD, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Home size={14} /> 홈으로</div>
          <div onClick={() => navigate('/')} style={{ color: '#ef4444', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><LogOut size={14} /> 나가기</div>
        </div>
      )}

    </div>
  );
};

export default GameOverlay;
