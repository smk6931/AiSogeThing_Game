import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useAuth } from '@contexts/AuthContext';
import itemApi from '@api/item';
import monsterApi from '@api/monster';
import worldApi from '@api/world';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'linear-gradient(180deg, rgba(5,11,18,0.99), rgba(8,14,22,0.98))';
const BORDER = 'rgba(124, 171, 166, 0.35)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';

const TIER_COLOR = { boss: '#ff4444', elite: '#ff9900', normal: '#67e8d6' };
const TIER_LABEL = { boss: 'BOSS', elite: 'ELITE', normal: 'NORMAL' };
const PROP_COLOR = {
  fire: '#ff6b35',
  water: '#38bdf8',
  forest: '#4ade80',
  stone: '#a8a29e',
  dark: '#a78bfa',
  magic: '#e879f9',
  earth: '#ca8a04',
};
const PROP_LABEL = {
  fire: '불',
  water: '물',
  forest: '숲',
  stone: '암석',
  dark: '암흑',
  magic: '마법',
  earth: '대지',
};

const RARITY_COLOR = {
  common: '#cbd5e1',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};
const RARITY_LABEL = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
};
const TYPE_LABEL = {
  weapon: '무기',
  armor: '갑옷',
  helmet: '투구',
  gloves: '장갑',
  boots: '각반',
  potion: '포션',
  material: '재료',
};
const ICON_MAP = {
  potion_hp_s: '🧪',
  potion_hp_m: '🧴',
  potion_hp_l: '⚗️',
  mat_goblin_ear: '👂',
  mat_orc_hide: '🧥',
  mat_slime_gel: '🫧',
  mat_witch_horn: '🦄',
  mat_zombie_bone: '🦴',
  mat_dragon_scale: '🐉',
  mat_ogre_heart: '❤️',
  weapon_wood_sword: '🗡️',
  weapon_iron_dagger: '🗡',
  armor_leather: '🦺',
  armor_mage_hat: '🎩',
  armor_chain: '⛓️',
  helmet_leather: '⛑️',
  helmet_steel: '🪖',
  gloves_leather: '🧤',
  gloves_magic: '✨',
  boots_leather: '🥾',
  boots_wind: '👢',
};

const CODEX_TABS = [
  { id: 'monster', label: '몬스터', emoji: '👾' },
  { id: 'item', label: '아이템', emoji: '🎒' },
  { id: 'skill', label: '스킬', emoji: '✨' },
  { id: 'world', label: '월드', emoji: '🗺️' },
];

const ComingSoon = ({ label }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#52736d',
      gap: '12px',
    }}
  >
    <Sparkles size={34} color="#35534d" />
    <div style={{ fontSize: '14px' }}>{label} 준비 중</div>
  </div>
);

/* ─── 월드 도감 ─────────────────────────────────────────── */

const THEME_COLOR = {
  sanctuary_green:  '#4ade80',
  urban_district:   '#60a5fa',
  commercial_hub:   '#fbbf24',
  residential:      '#a78bfa',
  industrial:       '#f97316',
  park_nature:      '#22c55e',
  mixed_use:        '#fb7185',
  cultural:         '#e879f9',
  waterfront:       '#38bdf8',
};
const themeColor = (code) => THEME_COLOR[code] || ACCENT;

const LEVEL_EMOJI = { city: '🏙️', district: '🏛️', dong: '🏘️', group: '🗂️', partition: '📍' };

/* 트리 구조 빌더 (flat → nested) */
function buildAreaTree(areas) {
  const byId = {};
  areas.forEach((a) => { byId[a.id] = { ...a, children: [] }; });
  const roots = [];
  areas.forEach((a) => {
    if (a.parent_id && byId[a.parent_id]) {
      byId[a.parent_id].children.push(byId[a.id]);
    } else if (!a.parent_id || !byId[a.parent_id]) {
      roots.push(byId[a.id]);
    }
  });
  // sort children by name
  const sort = (nodes) => nodes.sort((x, y) => x.name.localeCompare(y.name, 'ko'));
  Object.values(byId).forEach((n) => sort(n.children));
  return sort(roots);
}

/* GeoJSON → SVG path 변환 헬퍼 */
function extractGeoCoords(geojson) {
  if (!geojson) return [];
  const geo = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
  const rings =
    geo.type === 'Polygon' ? geo.coordinates :
    geo.type === 'MultiPolygon' ? geo.coordinates.flat() : [];
  return rings.flat().map(([lng, lat]) => ({ lat, lng }));
}

function geoToSvgPath(geojson, toXY) {
  if (!geojson) return null;
  const geo = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
  const rings =
    geo.type === 'Polygon' ? geo.coordinates :
    geo.type === 'MultiPolygon' ? geo.coordinates.flat() : null;
  if (!rings) return null;
  return rings
    .map((ring) =>
      'M ' +
      ring.map(([lng, lat]) => {
        const { x, y } = toXY(lat, lng);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' L ') +
      ' Z'
    )
    .join(' ');
}

/* 실제 GeoJSON 경계 기반 SVG 지도 */
function WorldMiniMap({ groups, partitions, selectedGroupId, selectedPartitionId, onSelectGroup, onSelectPartition, width = 480, height = 260 }) {
  const PAD = 16;

  /* 바운딩 박스: 파티션/그룹 boundary_geojson의 모든 좌표 사용 */
  const { minLat, maxLat, minLng, maxLng } = useMemo(() => {
    const pts = [];
    [...partitions, ...groups].forEach((item) => {
      extractGeoCoords(item.boundary_geojson).forEach((c) => pts.push(c));
      if (item.centroid_lat) pts.push({ lat: item.centroid_lat, lng: item.centroid_lng });
    });
    if (!pts.length) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const padV = (Math.max(...lats) - Math.min(...lats)) * 0.05 || 0.001;
    const padH = (Math.max(...lngs) - Math.min(...lngs)) * 0.05 || 0.001;
    return { minLat: Math.min(...lats) - padV, maxLat: Math.max(...lats) + padV, minLng: Math.min(...lngs) - padH, maxLng: Math.max(...lngs) + padH };
  }, [groups, partitions]);

  const toXY = useCallback((lat, lng) => ({
    x: PAD + ((lng - minLng) / (maxLng - minLng || 1)) * (width - PAD * 2),
    y: PAD + ((maxLat - lat) / (maxLat - minLat || 1)) * (height - PAD * 2),
  }), [minLat, maxLat, minLng, maxLng, width, height]);

  const hasData = partitions.length > 0 || groups.length > 0;
  if (!hasData) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: `1px solid ${BORDER}` }}>
        경계 데이터 없음
      </div>
    );
  }

  return (
    <svg
      width={width} height={height}
      style={{ background: 'rgba(2,8,16,0.85)', borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'default', flexShrink: 0 }}
    >
      {/* 파티션 폴리곤 */}
      {partitions.map((p) => {
        const d = geoToSvgPath(p.boundary_geojson, toXY);
        if (!d) return null;
        const col = themeColor(p.theme_code);
        const active = selectedPartitionId === p.id;
        const inActiveGroup = selectedGroupId && true; // 그룹 선택 시 해당 그룹 파티션
        return (
          <path
            key={p.id} d={d}
            fill={col} fillOpacity={active ? 0.55 : 0.2}
            stroke={active ? col : `${col}88`} strokeWidth={active ? 1.5 : 0.6}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelectPartition(p); }}
          >
            <title>{p.display_name}</title>
          </path>
        );
      })}

      {/* 그룹 경계 윤곽 */}
      {groups.map((g) => {
        const d = geoToSvgPath(g.boundary_geojson, toXY);
        const col = themeColor(g.theme_code);
        const active = selectedGroupId === g.id;
        return (
          <g key={g.id}>
            {d && (
              <path
                d={d}
                fill="none"
                stroke={col} strokeWidth={active ? 2.5 : 1.2}
                strokeOpacity={active ? 1 : 0.6}
                strokeDasharray={active ? 'none' : '4 2'}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectGroup(g)}
              />
            )}
            {/* 그룹 레이블 (centroid) */}
            {g.centroid_lat && g.centroid_lng && (() => {
              const { x, y } = toXY(g.centroid_lat, g.centroid_lng);
              return (
                <g style={{ cursor: 'pointer' }} onClick={() => onSelectGroup(g)}>
                  <circle cx={x} cy={y} r={active ? 13 : 9} fill={col} fillOpacity={active ? 0.3 : 0.15} stroke={col} strokeWidth={active ? 1.8 : 1} />
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={active ? 8 : 7} fill={active ? '#fff' : col} style={{ pointerEvents: 'none', fontFamily: 'sans-serif', fontWeight: active ? 700 : 400 }}>
                    {(g.display_name || '').slice(0, 4)}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── 그룹 DivIcon 생성 헬퍼 ─── */
function makeGroupIcon(g, state) {
  // state: 'default' | 'active' | 'dim'
  const col = themeColor(g.theme_code);
  const name = (g.display_name || '').slice(0, 5);
  const count = g.partition_count || 0;

  const cfg = {
    default: { size: 38, borderW: 1.5, fillAlpha: '22', textAlpha: 1, glow: false, scale: 1 },
    active:  { size: 48, borderW: 2.5, fillAlpha: '33', textAlpha: 1, glow: true,  scale: 1 },
    dim:     { size: 28, borderW: 1,   fillAlpha: '0d', textAlpha: 0.3, glow: false, scale: 1 },
  }[state] || {};

  const { size, borderW, fillAlpha, textAlpha, glow } = cfg;
  const glowCss = glow ? `box-shadow:0 0 12px ${col}99,0 0 4px ${col}66;` : '';
  const dimCss = state === 'dim' ? 'filter:saturate(0.3);' : '';

  const badgeHtml = count > 0 ? `
    <div style="
      position:absolute;top:-5px;right:-5px;
      background:${col};color:#050b12;
      font-size:7px;font-weight:800;border-radius:999px;
      padding:1px 4px;min-width:14px;text-align:center;
      line-height:14px;height:14px;
      font-family:sans-serif;
      opacity:${state === 'dim' ? 0.3 : 1};
    ">${count}</div>` : '';

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${col}${fillAlpha};
        border:${borderW}px solid ${col};
        display:flex;align-items:center;justify-content:center;
        font-size:${state === 'active' ? 9 : 8}px;
        color:${col};font-weight:${state === 'active' ? 700 : 600};
        font-family:sans-serif;text-align:center;line-height:1.2;
        cursor:pointer;opacity:${textAlpha};
        ${glowCss}${dimCss}
      ">${name}</div>
      ${badgeHtml}
    </div>`;

  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/* ─── Leaflet 레이어 컨트롤러 (고도화) ─── */
function MapLayersController({ groups, partitions, selectedGroupId, selectedPartitionId, onSelectGroup, onSelectPartition }) {
  const map = useMap();
  const gBoundaryRef = useRef({}); // group boundary GeoJSON layers
  const gMarkerRef   = useRef({}); // group centroid DivIcon markers
  const pLayerRef    = useRef({}); // partition GeoJSON layers
  const allGroupBoundsRef = useRef(null);

  /* 그룹 레이어 재구성 (groups 변경 시) */
  useEffect(() => {
    Object.values(gBoundaryRef.current).forEach((l) => { try { map.removeLayer(l); } catch (_) {} });
    Object.values(gMarkerRef.current).forEach((l) => { try { map.removeLayer(l); } catch (_) {} });
    gBoundaryRef.current = {};
    gMarkerRef.current = {};

    const bounds = [];

    groups.forEach((g) => {
      const col = themeColor(g.theme_code);

      /* 경계 폴리곤 */
      if (g.boundary_geojson) {
        try {
          const geo = typeof g.boundary_geojson === 'string' ? JSON.parse(g.boundary_geojson) : g.boundary_geojson;
          const layer = L.geoJSON(geo, {
            style: { color: col, weight: 1.5, fillColor: col, fillOpacity: 0.08, opacity: 0.55, dashArray: '5 3' },
          }).on('click', (e) => { L.DomEvent.stopPropagation(e); onSelectGroup(g); });
          layer.addTo(map);
          gBoundaryRef.current[g.id] = layer;
          bounds.push(layer.getBounds());
        } catch (_) {}
      }

      /* centroid 마커 */
      if (g.centroid_lat && g.centroid_lng) {
        const marker = L.marker([g.centroid_lat, g.centroid_lng], { icon: makeGroupIcon(g, 'default'), zIndexOffset: 100 })
          .on('click', () => onSelectGroup(g));
        marker.addTo(map);
        gMarkerRef.current[g.id] = marker;
      }
    });

    if (bounds.length) {
      try {
        const combined = bounds.reduce((a, b) => a.extend(b));
        allGroupBoundsRef.current = combined;
        map.fitBounds(combined, { padding: [28, 28], maxZoom: 16, animate: false });
      } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  /* 파티션 레이어 재구성 (partitions 변경 시) */
  useEffect(() => {
    Object.values(pLayerRef.current).forEach((l) => { try { map.removeLayer(l); } catch (_) {} });
    pLayerRef.current = {};

    partitions.forEach((p) => {
      if (!p.boundary_geojson) return;
      try {
        const geo = typeof p.boundary_geojson === 'string' ? JSON.parse(p.boundary_geojson) : p.boundary_geojson;
        const col = themeColor(p.theme_code);
        const layer = L.geoJSON(geo, {
          style: { color: col, weight: 0.8, fillColor: col, fillOpacity: 0.28, opacity: 0.75 },
        }).on('click', (e) => { L.DomEvent.stopPropagation(e); onSelectPartition(p); });
        layer.addTo(map);
        pLayerRef.current[p.id] = layer;
      } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partitions]);

  /* 선택 상태 변경 → 스타일 + 마커 업데이트 + 카메라 */
  useEffect(() => {
    const hasGroup = !!selectedGroupId;

    /* 그룹 경계 스타일 */
    Object.entries(gBoundaryRef.current).forEach(([id, layer]) => {
      const gid = Number(id);
      const g = groups.find((x) => x.id === gid);
      if (!g) return;
      const col = themeColor(g.theme_code);
      const active = selectedGroupId === gid;

      if (!hasGroup) {
        layer.setStyle({ color: col, weight: 1.5, fillOpacity: 0.08, opacity: 0.55, dashArray: '5 3' });
      } else if (active) {
        layer.setStyle({ color: col, weight: 2.5, fillColor: col, fillOpacity: 0.14, opacity: 1, dashArray: null });
        /* 선택된 그룹으로 카메라 이동 */
        try { map.fitBounds(layer.getBounds(), { padding: [32, 32], maxZoom: 17, animate: true }); } catch (_) {}
      } else {
        layer.setStyle({ color: col, weight: 0.8, fillOpacity: 0.03, opacity: 0.18, dashArray: '5 3' });
      }
    });

    /* 그룹 마커 아이콘 업데이트 */
    Object.entries(gMarkerRef.current).forEach(([id, marker]) => {
      const gid = Number(id);
      const g = groups.find((x) => x.id === gid);
      if (!g) return;
      const state = !hasGroup ? 'default' : selectedGroupId === gid ? 'active' : 'dim';
      marker.setIcon(makeGroupIcon(g, state));
    });

    /* 선택 해제 시 전체 뷰로 복귀 */
    if (!hasGroup && allGroupBoundsRef.current) {
      try { map.fitBounds(allGroupBoundsRef.current, { padding: [28, 28], maxZoom: 16, animate: true }); } catch (_) {}
    }

    /* 파티션 스타일 */
    Object.entries(pLayerRef.current).forEach(([id, layer]) => {
      const pid = Number(id);
      const p = partitions.find((x) => x.id === pid);
      if (!p) return;
      const col = themeColor(p.theme_code);
      const active = selectedPartitionId === pid;
      layer.setStyle({ color: active ? '#ffffff' : col, weight: active ? 2 : 0.8, fillOpacity: active ? 0.55 : 0.28, opacity: active ? 1 : 0.75 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedPartitionId, groups, partitions]);

  return null;
}

/* ─── WorldMapLeaflet: 서울 타일 + GeoJSON + 그룹 마커 ─── */
function WorldMapLeaflet({ groups, partitions, selectedGroupId, selectedPartitionId, onSelectGroup, onSelectPartition, loading = false, height = 240 }) {
  return (
    <div style={{ height, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}`, flexShrink: 0, position: 'relative' }}>
      <MapContainer
        center={[37.55, 126.98]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
          opacity={0.72}
        />
        <MapLayersController
          groups={groups}
          partitions={partitions}
          selectedGroupId={selectedGroupId}
          selectedPartitionId={selectedPartitionId}
          onSelectGroup={onSelectGroup}
          onSelectPartition={onSelectPartition}
        />
      </MapContainer>

      {/* 파티션 로딩 오버레이 */}
      {loading && (
        <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 9, color: ACCENT, background: 'rgba(5,11,18,0.8)', padding: '3px 8px', borderRadius: 999, border: `1px solid ${BORDER}`, pointerEvents: 'none' }}>
          파티션 로딩 중…
        </div>
      )}

      {/* 테마 범례 */}
      {groups.length > 0 && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(5,11,18,0.82)', borderRadius: 7, padding: '5px 7px', border: `1px solid ${BORDER}`, pointerEvents: 'none', maxWidth: 110 }}>
          {[...new Set(groups.map((g) => g.theme_code).filter(Boolean))].slice(0, 5).map((code) => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: themeColor(code), flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: '#8ca6a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 그룹 상세 패널 */
function GroupDetail({ group, partitions, loading, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '12px', marginBottom: '12px', padding: 0, fontFamily: GAME_FONT }}>
        <ChevronLeft size={14} /> 목록으로
      </button>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: `${themeColor(group.theme_code)}22`, border: `2px solid ${themeColor(group.theme_code)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          🗂️
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{group.display_name || group.group_key}</div>
          <div style={{ fontSize: 10, color: '#6a9a94', marginTop: 2 }}>
            <span style={{ padding: '1px 6px', borderRadius: 999, border: `1px solid ${themeColor(group.theme_code)}55`, color: themeColor(group.theme_code), marginRight: 6 }}>{group.theme_code || '?'}</span>
            파티션 {group.partition_count}개
          </div>
        </div>
      </div>
      {group.summary && (
        <div style={{ fontSize: 11, color: '#b6c5c2', lineHeight: 1.7, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
          {group.summary}
        </div>
      )}
      <div style={{ fontSize: 10, color: GOLD, letterSpacing: '1.5px', marginBottom: 8 }}>PARTITIONS</div>
      {loading ? (
        <div style={{ color: '#4a6a66', fontSize: 12 }}>불러오는 중...</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {partitions.map((p) => {
            const col = themeColor(p.theme_code);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#e2e8f0' }}>{p.display_name}</div>
                  {p.dominant_landuse && <div style={{ fontSize: 9, color: '#5a7a74', marginTop: 2 }}>{p.dominant_landuse}</div>}
                </div>
                {p.area_m2 && <div style={{ fontSize: 9, color: '#6a9a94', flexShrink: 0 }}>{(p.area_m2 / 10000).toFixed(2)}ha</div>}
              </div>
            );
          })}
          {!partitions.length && <div style={{ color: '#4a6a66', fontSize: 12 }}>파티션 없음</div>}
        </div>
      )}
    </div>
  );
}

/* 월드 도감 메인 */
const WorldCodex = () => {
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'map'
  const [areas, setAreas] = useState([]);
  const [tree, setTree] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  // 선택 경로: district → dong
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedDong, setSelectedDong] = useState(null);

  // 그룹 목록 (동 선택 시 로드)
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // 파티션 목록 (그룹 선택 시 로드)
  const [partitions, setPartitions] = useState([]);
  const [loadingPartitions, setLoadingPartitions] = useState(false);
  const [selectedPartition, setSelectedPartition] = useState(null);

  useEffect(() => {
    worldApi.getCodexAreas()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setAreas(data);
        setTree(buildAreaTree(data));
      })
      .catch(() => setAreas([]))
      .finally(() => setLoadingAreas(false));
  }, []);

  const selectDong = useCallback((dong) => {
    setSelectedDong(dong);
    setSelectedGroup(null);
    setSelectedPartition(null);
    setPartitions([]);
    setGroups([]);
    setLoadingGroups(true);
    worldApi.getCodexDongGroups(dong.id)
      .then((res) => setGroups(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, []);

  const selectGroup = useCallback((group) => {
    setSelectedGroup(group);
    setSelectedPartition(null);
    setPartitions([]);
    setLoadingPartitions(true);
    worldApi.getCodexGroupPartitions(group.id)
      .then((res) => setPartitions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPartitions([]))
      .finally(() => setLoadingPartitions(false));
  }, []);

  const selectPartition = useCallback((partition) => {
    setSelectedPartition((prev) => prev?.id === partition.id ? null : partition);
  }, []);

  // 브레드크럼
  const breadcrumb = [];
  if (selectedDistrict) breadcrumb.push({ label: selectedDistrict.name, onClick: () => { setSelectedDistrict(null); setSelectedDong(null); setSelectedGroup(null); setSelectedPartition(null); setGroups([]); setPartitions([]); } });
  if (selectedDong) breadcrumb.push({ label: selectedDong.name, onClick: () => { setSelectedDong(null); setSelectedGroup(null); setSelectedPartition(null); setGroups([]); setPartitions([]); } });
  if (selectedGroup) breadcrumb.push({ label: selectedGroup.display_name || selectedGroup.group_key, onClick: () => { setSelectedGroup(null); setSelectedPartition(null); setPartitions([]); } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 상단 뷰 토글 + 브레드크럼 + 1차 초안 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* 뷰 토글 */}
        <div style={{ display: 'flex', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {[{ id: 'tree', label: '트리' }, { id: 'map', label: '지도' }].map((v) => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{ padding: '4px 12px', fontSize: 11, cursor: 'pointer', background: viewMode === v.id ? 'rgba(103,232,214,0.15)' : 'transparent', color: viewMode === v.id ? ACCENT : '#6a9a94', border: 'none', fontFamily: GAME_FONT }}>
              {v.label}
            </button>
          ))}
        </div>
        {/* 브레드크럼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6a9a94', flex: 1, flexWrap: 'wrap' }}>
          <span style={{ color: GOLD }}>서울시</span>
          {breadcrumb.map((bc, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={10} color="#4a6a66" />
              <button onClick={bc.onClick} style={{ background: 'none', border: 'none', color: i === breadcrumb.length - 1 ? '#e2e8f0' : ACCENT, cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: GAME_FONT }}>
                {bc.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        {/* 1차 초안 배지 */}
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(208,177,107,0.4)', color: '#9a7e45', background: 'rgba(208,177,107,0.07)', letterSpacing: '0.5px', flexShrink: 0 }}>
          1차 초안
        </span>
      </div>

      {/* 콘텐츠 */}
      {loadingAreas ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: 13 }}>불러오는 중...</div>
      ) : viewMode === 'tree' ? (
        /* ── 트리 뷰 ── */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedGroup ? (
            <GroupDetail group={selectedGroup} partitions={partitions} loading={loadingPartitions} onBack={() => { setSelectedGroup(null); setSelectedPartition(null); setPartitions([]); }} />
          ) : selectedDong ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '1.5px', marginBottom: 4 }}>GROUPS — {selectedDong.name}</div>
              {loadingGroups ? (
                <div style={{ color: '#4a6a66', fontSize: 12 }}>불러오는 중...</div>
              ) : groups.length === 0 ? (
                <div style={{ color: '#4a6a66', fontSize: 12 }}>등록된 그룹 없음</div>
              ) : groups.map((g) => {
                const col = themeColor(g.theme_code);
                return (
                  <button key={g.id} onClick={() => selectGroup(g)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: `linear-gradient(135deg, rgba(8,14,22,0.9), ${col}0d)`, border: `1px solid ${col}33`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${col}22`, border: `1px solid ${col}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🗂️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{g.display_name || g.group_key}</div>
                      <div style={{ fontSize: 9, color: '#6a9a94', marginTop: 2 }}>
                        <span style={{ color: col }}>{g.theme_code || '?'}</span>{' · '}파티션 {g.partition_count}개
                      </div>
                    </div>
                    <ChevronRight size={14} color="#4a6a66" />
                  </button>
                );
              })}
            </div>
          ) : selectedDistrict ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '1.5px', marginBottom: 4 }}>DONGS — {selectedDistrict.name}</div>
              {selectedDistrict.children.map((dong) => (
                <button key={dong.id} onClick={() => selectDong(dong)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 18 }}>🏘️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{dong.name}</div>
                    <div style={{ fontSize: 9, color: '#6a9a94', marginTop: 2 }}>그룹 {dong.group_count}개 · 파티션 {dong.partition_count}개</div>
                  </div>
                  <ChevronRight size={14} color="#4a6a66" />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '1.5px', marginBottom: 4 }}>DISTRICTS — 서울특별시</div>
              {tree.flatMap((city) => city.children).map((district) => {
                const partCount = district.children.reduce((s, d) => s + (d.partition_count || 0), 0);
                return (
                  <button key={district.id} onClick={() => setSelectedDistrict(district)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 18 }}>🏛️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{district.name}</div>
                      <div style={{ fontSize: 9, color: '#6a9a94', marginTop: 2 }}>동 {district.children.length}개 · 파티션 {partCount}개</div>
                    </div>
                    <ChevronRight size={14} color="#4a6a66" />
                  </button>
                );
              })}
              {tree.flatMap((c) => c.children).length === 0 && (
                <div style={{ color: '#4a6a66', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>구 데이터 없음</div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── 지도 뷰 ── */
        <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>
          {/* 동 선택 사이드 */}
          <div style={{ width: 110, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 9, color: GOLD, letterSpacing: '1.5px', marginBottom: 4 }}>동 선택</div>
            {areas.filter((a) => a.area_level === 'dong' && a.partition_count > 0).map((dong) => (
              <button key={dong.id} onClick={() => { setSelectedDistrict(null); selectDong(dong); }} style={{ padding: '5px 7px', fontSize: 10, borderRadius: 6, cursor: 'pointer', background: selectedDong?.id === dong.id ? 'rgba(103,232,214,0.14)' : 'transparent', border: `1px solid ${selectedDong?.id === dong.id ? ACCENT : BORDER}`, color: selectedDong?.id === dong.id ? ACCENT : '#8ca6a0', textAlign: 'left', fontFamily: GAME_FONT }}>
                {dong.name}
                <span style={{ display: 'block', fontSize: 8, color: '#4a6a66', marginTop: 1 }}>파티션 {dong.partition_count}</span>
              </button>
            ))}
            {areas.filter((a) => a.area_level === 'dong' && a.partition_count > 0).length === 0 && (
              <div style={{ fontSize: 10, color: '#4a6a66' }}>데이터 없음</div>
            )}
          </div>

          {/* 지도 영역 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minWidth: 0 }}>
            {!selectedDong ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: 12 }}>← 동을 선택하세요</div>
            ) : loadingGroups ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: 12 }}>경계 불러오는 중...</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700 }}>{selectedDong.name}</span>
                  {loadingPartitions && <span style={{ fontSize: 9, color: '#4a6a66' }}>파티션 로딩중...</span>}
                </div>
                {/* 서울 지도 타일 + GeoJSON 경계 + 그룹 마커 */}
                <WorldMapLeaflet
                  groups={groups}
                  partitions={partitions}
                  selectedGroupId={selectedGroup?.id}
                  selectedPartitionId={selectedPartition?.id}
                  onSelectGroup={(g) => { selectGroup(g); setSelectedPartition(null); }}
                  onSelectPartition={selectPartition}
                  loading={loadingPartitions}
                  height={selectedGroup ? 195 : 255}
                />
                {/* 선택 상태 정보 패널 */}
                {(selectedPartition || selectedGroup) && (
                  <div style={{ padding: '8px 10px', background: selectedPartition ? `${themeColor(selectedPartition.theme_code)}10` : `${themeColor(selectedGroup.theme_code)}10`, border: `1px solid ${selectedPartition ? themeColor(selectedPartition.theme_code) : themeColor(selectedGroup.theme_code)}44`, borderRadius: 8, flexShrink: 0 }}>
                    {selectedPartition ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>📍 {selectedPartition.display_name}</span>
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 999, border: `1px solid ${themeColor(selectedPartition.theme_code)}55`, color: themeColor(selectedPartition.theme_code) }}>{selectedPartition.theme_code}</span>
                          {selectedPartition.area_m2 && <span style={{ fontSize: 8, color: '#4a6a66', marginLeft: 'auto' }}>{(selectedPartition.area_m2 / 10000).toFixed(2)}ha</span>}
                        </div>
                        {selectedPartition.dominant_landuse && <div style={{ fontSize: 9, color: '#6a9a94' }}>{selectedPartition.dominant_landuse}</div>}
                        {selectedPartition.summary && <div style={{ fontSize: 10, color: '#b6c5c2', lineHeight: 1.6, marginTop: 4 }}>{selectedPartition.summary}</div>}
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>🗂️ {selectedGroup.display_name}</span>
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 999, border: `1px solid ${themeColor(selectedGroup.theme_code)}55`, color: themeColor(selectedGroup.theme_code) }}>{selectedGroup.theme_code}</span>
                          <span style={{ fontSize: 8, color: '#4a6a66', marginLeft: 'auto' }}>파티션 {selectedGroup.partition_count}개</span>
                        </div>
                        {selectedGroup.summary && <div style={{ fontSize: 10, color: '#b6c5c2', lineHeight: 1.6 }}>{selectedGroup.summary}</div>}
                        {!loadingPartitions && partitions.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                            {partitions.slice(0, 6).map((p) => (
                              <span key={p.id} onClick={() => selectPartition(p)} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 999, background: `${themeColor(p.theme_code)}18`, border: `1px solid ${themeColor(p.theme_code)}44`, color: themeColor(p.theme_code), cursor: 'pointer' }}>{p.display_name}</span>
                            ))}
                            {partitions.length > 6 && <span style={{ fontSize: 8, color: '#4a6a66' }}>+{partitions.length - 6}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MonsterDetail = ({ monster, onBack }) => {
  const tier = monster.tier || 'normal';
  const tierColor = TIER_COLOR[tier] || ACCENT;
  const propertyColor = PROP_COLOR[monster.property_type] || '#aaa';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: ACCENT,
          cursor: 'pointer',
          fontSize: '12px',
          marginBottom: '16px',
          padding: 0,
          fontFamily: GAME_FONT,
        }}
      >
        <ChevronLeft size={14} />
        목록으로
      </button>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${tierColor}22, ${tierColor}44)`,
            border: `2px solid ${tierColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '42px',
            flexShrink: 0,
          }}
        >
          {monster.icon_emoji || '👹'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${tierColor}`, color: tierColor }}>
              {TIER_LABEL[tier]}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${propertyColor}`, color: propertyColor }}>
              {PROP_LABEL[monster.property_type] || monster.property_type}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>{monster.name_ko}</div>
          <div style={{ fontSize: '11px', color: '#6a9a94', marginTop: '3px' }}>{monster.name_en} · #{String(monster.id).padStart(3, '0')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'HP', value: monster.base_hp?.toLocaleString(), color: '#ef4444' },
          { label: 'EXP', value: `+${monster.base_exp}`, color: '#fbbf24' },
          { label: '출신', value: monster.origin_region || '-', color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '9px', color: '#6a9a94', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {monster.description && (
        <div style={{ fontSize: '11px', color: '#b6c5c2', lineHeight: 1.8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${BORDER}`, marginBottom: '16px' }}>
          {monster.description}
        </div>
      )}

      {monster.drop_items?.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>DROP ITEMS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {monster.drop_items.map((drop, index) => (
              <div
                key={`${monster.id}_${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '8px',
                  border: `1px solid ${BORDER}`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                  <span style={{ fontSize: '18px' }}>{drop.icon || '🎁'}</span>
                  {drop.item}
                </span>
                <span style={{ color: drop.rate >= 1 ? '#4ade80' : GOLD, fontSize: '11px', fontWeight: '700' }}>
                  {drop.rate >= 1 ? '100%' : `${Math.round(drop.rate * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MonsterList = ({ onSelect }) => {
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    monsterApi.getAllTemplates()
      .then((res) => setMonsters(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMonsters([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? monsters : monsters.filter((monster) => monster.tier === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {['all', 'normal', 'elite', 'boss'].map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              cursor: 'pointer',
              border: `1px solid ${filter === tier ? TIER_COLOR[tier] || ACCENT : BORDER}`,
              background: filter === tier ? `${TIER_COLOR[tier] || ACCENT}20` : 'transparent',
              color: filter === tier ? (TIER_COLOR[tier] || ACCENT) : '#8ca6a0',
              fontFamily: GAME_FONT,
            }}
          >
            {tier === 'all' ? 'ALL' : TIER_LABEL[tier]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4a6a66', alignSelf: 'center' }}>{filtered.length} / {monsters.length}</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '13px' }}>
          불러오는 중...
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: '10px', paddingRight: '4px' }}>
          {filtered.map((monster) => {
            const tierColor = TIER_COLOR[monster.tier] || ACCENT;
            const propertyColor = PROP_COLOR[monster.property_type] || '#aaa';
            return (
              <button
                key={monster.id}
                onClick={() => onSelect(monster)}
                style={{
                  padding: '12px 10px',
                  background: `linear-gradient(160deg, rgba(8,14,22,0.9), ${tierColor}0d)`,
                  border: `1px solid ${tierColor}44`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#e2e8f0',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${tierColor}20, ${tierColor}38)`,
                    border: `1px solid ${tierColor}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  {monster.icon_emoji || '👹'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'center', lineHeight: 1.3 }}>{monster.name_ko}</div>
                <div style={{ fontSize: '9px', color: '#5a7a74' }}>{monster.name_en}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${tierColor}66`, color: tierColor }}>
                    {TIER_LABEL[monster.tier]}
                  </span>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${propertyColor}66`, color: propertyColor }}>
                    {PROP_LABEL[monster.property_type] || monster.property_type}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '9px', color: '#6a9a94', marginTop: '2px' }}>
                  <span>HP {monster.base_hp?.toLocaleString()}</span>
                  <span>+{monster.base_exp} EXP</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ItemDetail = ({ item, onBack }) => {
  if (!item) return null;

  const rarityColor = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const stats = item.stat_bonus ? Object.entries(item.stat_bonus) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: ACCENT,
          cursor: 'pointer',
          fontSize: '12px',
          marginBottom: '16px',
          padding: 0,
          fontFamily: GAME_FONT,
        }}
      >
        <ChevronLeft size={14} />
        목록으로
      </button>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}45)`,
            border: `2px solid ${rarityColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            flexShrink: 0,
          }}
        >
          {ICON_MAP[item.icon_key] || '📦'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${rarityColor}`, color: rarityColor }}>
              {RARITY_LABEL[item.rarity] || item.rarity}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${BORDER}`, color: '#c8e8e2' }}>
              {TYPE_LABEL[item.item_type] || item.item_type}
            </span>
            {item.quantity > 0 && (
              <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: '1px solid rgba(103,232,214,0.45)', color: ACCENT }}>
                보유 x{item.quantity}
              </span>
            )}
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>{item.name_ko}</div>
          <div style={{ fontSize: '11px', color: '#6a9a94', marginTop: '3px' }}>{item.name_en} · #{String(item.item_id).padStart(3, '0')}</div>
        </div>
      </div>

      {stats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {stats.map(([stat, value]) => (
            <div key={stat} style={{ padding: '8px 10px', background: 'rgba(103,232,214,0.06)', borderRadius: '8px', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: '9px', color: '#7ea9a1' }}>{stat.toUpperCase()}</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: ACCENT }}>+{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, color: '#c7d4d1', fontSize: '12px', lineHeight: 1.7 }}>
        {item.description || '설명이 아직 없습니다.'}
      </div>
    </div>
  );
};

const ItemList = ({ userId, onSelect }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [ownedOnlyFallback, setOwnedOnlyFallback] = useState(false);

  useEffect(() => {
    setLoading(true);
    setOwnedOnlyFallback(false);
    itemApi.getTemplates(userId)
      .then((res) => {
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(async () => {
        if (!userId) {
          setItems([]);
          return;
        }
        try {
          const res = await itemApi.getInventory(userId);
          setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          setOwnedOnlyFallback(true);
        } catch (_) {
          setItems([]);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'owned') return items.filter((item) => Number(item.quantity) > 0);
    return items.filter((item) => item.rarity === filter || item.item_type === filter);
  }, [filter, items]);

  const filters = [
    { id: 'all', label: '전체' },
    { id: 'owned', label: '보유' },
    { id: 'weapon', label: '무기' },
    { id: 'armor', label: '방어구' },
    { id: 'potion', label: '포션' },
    { id: 'material', label: '재료' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {filters.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setFilter(entry.id)}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              cursor: 'pointer',
              border: `1px solid ${filter === entry.id ? ACCENT : BORDER}`,
              background: filter === entry.id ? 'rgba(103,232,214,0.14)' : 'transparent',
              color: filter === entry.id ? ACCENT : '#8ca6a0',
              fontFamily: GAME_FONT,
            }}
          >
            {entry.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4a6a66', alignSelf: 'center' }}>{filtered.length} / {items.length}</span>
      </div>

      {ownedOnlyFallback && (
        <div style={{ marginBottom: '10px', fontSize: '10px', color: '#d0b16b' }}>
          전체 아이템 API 응답이 없어 보유 아이템만 표시 중
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '13px' }}>
          불러오는 중...
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: '10px', paddingRight: '4px' }}>
          {filtered.map((item) => {
            const rarityColor = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
            const owned = Number(item.quantity) > 0;
            return (
              <button
                key={item.item_id}
                onClick={() => onSelect(item)}
                style={{
                  padding: '12px 10px',
                  background: owned
                    ? `linear-gradient(160deg, rgba(8,14,22,0.9), ${rarityColor}10)`
                    : 'linear-gradient(160deg, rgba(8,14,22,0.86), rgba(90,100,110,0.08))',
                  border: `1px solid ${owned ? `${rarityColor}55` : 'rgba(90,100,110,0.22)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  color: owned ? '#e2e8f0' : '#6b7280',
                  filter: owned ? 'none' : 'saturate(0.2)',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}38)`,
                    border: `1px solid ${owned ? `${rarityColor}66` : 'rgba(90,100,110,0.22)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  {ICON_MAP[item.icon_key] || '📦'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'center', lineHeight: 1.3 }}>{item.name_ko}</div>
                <div style={{ fontSize: '9px', color: owned ? '#5a7a74' : '#5f6972' }}>{TYPE_LABEL[item.item_type] || item.item_type}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${owned ? `${rarityColor}66` : 'rgba(90,100,110,0.22)'}`, color: owned ? rarityColor : '#6b7280' }}>
                    {RARITY_LABEL[item.rarity] || item.rarity}
                  </span>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${owned ? 'rgba(103,232,214,0.45)' : 'rgba(90,100,110,0.22)'}`, color: owned ? ACCENT : '#6b7280' }}>
                    {owned ? `보유 ${item.quantity}` : '미획득'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GameCodex = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('monster');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const resetSelection = () => {
    setSelectedMonster(null);
    setSelectedItem(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(760px, 92vw)',
          height: 'min(600px, 88vh)',
          background: PANEL_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 0 48px rgba(103,232,214,0.08)',
          fontFamily: GAME_FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={18} color={GOLD} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: GOLD, letterSpacing: '2px' }}>GAME CODEX</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="#5a7a74" />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '92px', borderRight: `1px solid ${BORDER}`, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            {CODEX_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  resetSelection();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 6px',
                  margin: '0 8px',
                  borderRadius: '8px',
                  background: activeTab === tab.id ? 'rgba(103,232,214,0.1)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? ACCENT : 'transparent'}`,
                  cursor: 'pointer',
                  color: activeTab === tab.id ? ACCENT : '#4a6a64',
                }}
              >
                <span style={{ fontSize: '20px' }}>{tab.emoji}</span>
                <span style={{ fontSize: '9px', fontFamily: GAME_FONT }}>{tab.label}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '16px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'monster' && (
              selectedMonster
                ? <MonsterDetail monster={selectedMonster} onBack={() => setSelectedMonster(null)} />
                : <MonsterList onSelect={setSelectedMonster} />
            )}
            {activeTab === 'item' && (
              selectedItem
                ? <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />
                : <ItemList userId={user?.id} onSelect={setSelectedItem} />
            )}
            {activeTab === 'skill' && <ComingSoon label="스킬 도감" />}
            {activeTab === 'world' && <WorldCodex />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCodex;
