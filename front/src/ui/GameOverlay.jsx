import React, { useEffect, useRef, useState } from 'react';
import { Flame, Home, LogOut, Settings, Shield, Sword, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import worldApi from '@api/world';
import { useAuth } from '@contexts/AuthContext';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';

import LeafletMapBackground from './LeafletMapBackground';

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
  link.href =
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap';
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
  const [currentDong, setCurrentDong] = useState(null);
  const [currentRegionInfo, setCurrentRegionInfo] = useState(null);
  const [currentPartition, setCurrentPartition] = useState(null);
  const [showZoneTitle, setShowZoneTitle] = useState(false);
  const [showPartitionTitle, setShowPartitionTitle] = useState(false);

  const lastDistrictRef = useRef('');
  const lastDongRef = useRef('');
  const lastPartitionRef = useRef('');
  const partitionTimerRef = useRef(null);
  const zoneTimerRef = useRef(null);

  const { districts, getDistrictAt } = useSeoulDistricts();
  const { dongs, getDongAt } = useSeoulDongs();

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

  useEffect(() => {
    const updateGps = () => {
      if (!myPositionRef?.current) return;

      const { x, z } = myPositionRef.current;
      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);
      setGpsCoords({ lat, lng });

      if (getDistrictAt) {
        const foundDistrict = getDistrictAt(lat, lng);
        const districtName = foundDistrict?.name || '';
        if (districtName && districtName !== lastDistrictRef.current) {
          setCurrentDistrict(foundDistrict);
          lastDistrictRef.current = districtName;
          setShowZoneTitle(true);
          if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
          zoneTimerRef.current = setTimeout(() => setShowZoneTitle(false), 3000);
        }
      }

      if (getDongAt) {
        const foundDong = getDongAt(lat, lng);
        const dongName = foundDong?.name || '';
        if (dongName && dongName !== lastDongRef.current) {
          setCurrentDong(foundDong);
          lastDongRef.current = dongName;
        }
      }
    };

    const interval = setInterval(updateGps, 500);
    return () => clearInterval(interval);
  }, [myPositionRef, getDistrictAt, getDongAt]);

  useEffect(() => {
    let cancelled = false;

    const loadRegionInfo = async () => {
      if (!currentDong?.id) {
        setCurrentRegionInfo(null);
        setCurrentPartition(null);
        return;
      }

      try {
        const response = await worldApi.getCurrentRegion(gpsCoords.lat, gpsCoords.lng);
        if (cancelled) return;

        const nextRegion = response.data?.db_region || null;
        const nextPartition = response.data?.current_partition || null;
        setCurrentRegionInfo(nextRegion);
        setCurrentPartition(nextPartition);

        const nextPartitionKey = nextPartition?.partition_key || '';
        if (nextPartitionKey && nextPartitionKey !== lastPartitionRef.current) {
          lastPartitionRef.current = nextPartitionKey;
          setShowPartitionTitle(true);
          if (partitionTimerRef.current) clearTimeout(partitionTimerRef.current);
          partitionTimerRef.current = setTimeout(() => setShowPartitionTitle(false), 2200);
        }
      } catch (error) {
        if (cancelled) return;
        setCurrentRegionInfo(null);
        setCurrentPartition(null);
      }
    };

    const timer = setTimeout(loadRegionInfo, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentDong?.id, gpsCoords.lat, gpsCoords.lng]);

  const playerStats = {
    hp: myStats?.hp || 100,
    maxHp: myStats?.maxHp || 100,
    mp: myStats?.mp || 50,
    maxMp: myStats?.maxMp || 50,
    level: myStats?.level || 1,
    nickname: user?.nickname || 'Guest',
  };

  const hpPct = Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (playerStats.mp / playerStats.maxMp) * 100));

  const skills = [
    { key: 'Q', icon: Sword, label: 'Slash', cooldown: 0 },
    { key: 'W', icon: Shield, label: 'Guard', cooldown: 2 },
    { key: 'E', icon: Zap, label: 'Spark', cooldown: 0 },
    { key: 'R', icon: Flame, label: 'Burst', cooldown: 10 },
  ];

  const items = [
    { key: '1', name: 'Potion', count: 5, icon: '🧪' },
    { key: '2', name: 'Mana', count: 3, icon: '💧' },
    { key: '3', name: '', count: 0, icon: '' },
    { key: '4', name: '', count: 0, icon: '' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        fontFamily: GAME_FONT,
      }}
    >
      <div
        style={{
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
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${GOLD})`,
              color: '#081015',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: isMobile ? '22px' : '28px',
              height: isMobile ? '22px' : '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '11px' : '13px',
            }}
          >
            {playerStats.level}
          </div>
          <span style={{ color: GOLD, fontWeight: '700', fontSize: isMobile ? '12px' : '15px' }}>
            {playerStats.nickname}
          </span>
        </div>

        <div style={{ marginBottom: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '11px', color: '#aaa' }}>
            <span style={{ color: '#ff6b6b' }}>HP</span>
            <span>{playerStats.hp}/{playerStats.maxHp}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${hpPct}%`, height: '100%', background: 'linear-gradient(90deg, #b91c1c, #ef4444)' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '11px', color: '#aaa' }}>
            <span style={{ color: '#60a5fa' }}>MP</span>
            <span>{playerStats.mp}/{playerStats.maxMp}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${mpPct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }} />
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: isMobile ? 'max(10px, env(safe-area-inset-top))' : '18px',
          right: isMobile ? 'max(10px, env(safe-area-inset-right))' : '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', pointerEvents: 'auto' }}>
          <div
            style={{
              position: 'relative',
              width: isMobile ? '94px' : '136px',
              height: isMobile ? '94px' : '136px',
              background: PANEL_BG,
              borderRadius: '50%',
              border: `2px solid ${BORDER_COLOR}`,
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: GLOW,
            }}
            onClick={() => setIsMapExpanded(true)}
          >
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

            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '8px',
                height: '8px',
                background: ACCENT,
                borderRadius: '50%',
                boxShadow: `0 0 10px ${ACCENT}`,
                zIndex: 10,
              }}
            />

            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                color: '#dffdfa',
                background: 'rgba(4,12,18,0.72)',
                padding: '2px 8px',
                borderRadius: '10px',
                zIndex: 11,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Users size={10} color={GOLD} /> {onlineCount}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => setMapZoom((z) => Math.min(z + 1, 19))}
              style={{ width: '28px', height: '28px', background: 'rgba(10,18,26,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: ACCENT, cursor: 'pointer' }}
            >
              +
            </button>
            <button
              onClick={() => setMapZoom((z) => Math.max(z - 1, 10))}
              style={{ width: '28px', height: '28px', background: 'rgba(10,18,26,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '50%', color: ACCENT, cursor: 'pointer' }}
            >
              -
            </button>
          </div>
        </div>

        {!isMapExpanded && (
          <>
            <div
              style={{
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
                boxShadow: currentDistrict?.name?.includes('동작') ? '0 0 12px rgba(103, 232, 214, 0.22)' : 'none',
              }}
            >
              <Flame size={12} color={currentDistrict?.name?.includes('동작') ? ACCENT : GOLD} />
              {currentDistrict?.name || 'SEOUL'}
            </div>

            {currentRegionInfo && (
              <div
                style={{
                  width: isMobile ? '220px' : '300px',
                  padding: isMobile ? '10px 12px' : '12px 14px',
                  borderRadius: '16px',
                  background: 'linear-gradient(180deg, rgba(8, 14, 20, 0.94), rgba(7, 10, 16, 0.92))',
                  border: `1px solid ${BORDER_COLOR}`,
                  boxShadow: GLOW,
                  color: '#eefaf7',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '1.2px', marginBottom: '4px' }}>DB REGION</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', marginBottom: '4px' }}>
                  {currentRegionInfo.admin_area?.name || currentDong?.name}
                </div>
                <div style={{ fontSize: '11px', color: '#9fb7b2', marginBottom: '8px' }}>
                  Partition Count {currentRegionInfo.partition_count}
                </div>

                {currentPartition && (
                  <div style={{ fontSize: '12px', lineHeight: 1.45 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px' }}>
                        PARTITION #{currentPartition.partition_seq}
                      </div>
                      <div style={{ color: '#8ca6a0', fontSize: '10px' }}>
                        {currentPartition.partition_key}
                      </div>
                    </div>
                    <div style={{ color: '#d7e6e2', fontSize: '11px', marginBottom: '3px' }}>
                      {currentPartition.map_name}
                    </div>
                    <div style={{ color: ACCENT, fontWeight: '700', marginBottom: '2px' }}>
                      {currentPartition.display_name}
                    </div>
                    <div style={{ color: '#d7e6e2' }}>
                      {currentPartition.summary || currentPartition.description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {isMapExpanded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: '80vw',
              height: '70vh',
              background: PANEL_BG,
              borderRadius: '16px',
              border: `2px solid ${BORDER_COLOR}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom + 1}
                districts={districts}
                dongs={dongs}
                currentDistrictId={currentDistrict?.id || null}
                currentDongId={currentDong?.id || null}
                interactive
                showSeoulMask
                onZoomChange={(newZoom) => setMapZoom(newZoom - 1)}
              />
            </div>

            <div
              style={{ position: 'absolute', top: '16px', right: '16px', color: '#ff4444', fontSize: '24px', cursor: 'pointer', zIndex: 10 }}
              onClick={() => setIsMapExpanded(false)}
            >
              ×
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(0,0,0,0.8)',
                padding: '10px',
                borderRadius: '8px',
                color: '#4ade80',
                zIndex: 10,
              }}
            >
              <div style={{ fontSize: '10px', color: '#aaa' }}>GPS TRACKING</div>
              <div style={{ fontSize: '14px' }}>
                LAT: {gpsCoords.lat.toFixed(6)}° / LNG: {gpsCoords.lng.toFixed(6)}°
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '12px',
                height: '12px',
                background: '#4ade80',
                borderRadius: '50%',
                boxShadow: '0 0 15px #4ade80',
                zIndex: 10,
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: isMobile ? 'none' : 'flex',
          gap: '12px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {skills.map((skill) => (
            <div
              key={skill.key}
              style={{
                width: '60px',
                height: '60px',
                background: PANEL_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ position: 'absolute', top: '4px', left: '6px', fontSize: '10px', color: GOLD }}>
                {skill.key}
              </span>
              <skill.icon size={24} color="#fff" />
              {skill.cooldown > 0 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                  {skill.cooldown}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ width: '1px', height: '60px', background: BORDER_COLOR, opacity: 0.5 }} />

        <div style={{ display: 'flex', gap: '6px' }}>
          {items.map((item) => (
            <div
              key={item.key}
              style={{
                width: '50px',
                height: '50px',
                background: PANEL_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#888' }}>
                {item.key}
              </span>
              {item.icon}
              {item.count > 0 && (
                <span style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '10px', color: GOLD, fontWeight: 'bold' }}>
                  {item.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isMobile && (
        <div
          onClick={() => onSimulateKey('r', true)}
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '25px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255,120,120,0.95), rgba(220,38,38,0.82))',
            border: '1px solid rgba(255,210,180,0.32)',
            boxShadow: '0 10px 24px rgba(220,38,38,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            pointerEvents: 'auto',
          }}
        >
          ⚔
        </div>
      )}

      {showZoneTitle && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 3s forwards',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '4px' }}>
            NOW ENTERING
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', letterSpacing: '2px' }}>
            {currentDistrict?.name || ''}
          </div>
          {currentDistrict?.name_en && (
            <div style={{ color: '#aaa', fontSize: '18px', marginTop: '4px' }}>{currentDistrict.name_en}</div>
          )}
          <div style={{ width: '200px', height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: '10px' }} />
        </div>
      )}

      {showPartitionTitle && currentPartition && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 2.2s forwards',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: ACCENT, fontSize: '12px', fontWeight: '700', letterSpacing: '3px', marginBottom: '4px' }}>
            PARTITION ENTERED
          </div>
          <div style={{ color: GOLD, fontSize: '12px', marginBottom: '4px' }}>
            {currentPartition.map_name} [{currentPartition.partition_seq}]
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '20px' : '30px', fontWeight: '700', textAlign: 'center' }}>
            {currentPartition.display_name}
          </div>
        </div>
      )}

      <div
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          position: 'absolute',
          top: isMobile ? '150px' : '170px',
          right: isMobile ? '10px' : '20px',
          width: '32px',
          height: '32px',
          background: 'rgba(8,14,22,0.88)',
          border: `1px solid ${BORDER_COLOR}`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: GLOW,
        }}
      >
        <Settings size={16} color={GOLD} />
      </div>

      {isMenuOpen && (
        <div
          style={{
            position: 'absolute',
            top: isMobile ? '190px' : '210px',
            right: isMobile ? '10px' : '20px',
            background: 'rgba(8,14,22,0.94)',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '12px',
            padding: '8px',
            zIndex: 100,
            pointerEvents: 'auto',
            minWidth: '120px',
            boxShadow: GLOW,
          }}
        >
          <div onClick={() => navigate('/')} style={{ color: GOLD, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Home size={14} /> Home
          </div>
          <div onClick={() => navigate('/')} style={{ color: '#ef4444', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={14} /> Leave
          </div>
        </div>
      )}
    </div>
  );
};

export default GameOverlay;
