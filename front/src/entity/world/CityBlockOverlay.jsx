import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';
import worldApi from '@api/world';

const TEXTURE_PROFILE_MAP = {
  frozen_bank_a: '/grounds/Lucid_Origin_frozen_tundra_landscape_from_directly_above_with__0.jpg',
  frozen_bank_b: '/grounds/Lucid_Origin_frozen_tundra_landscape_from_directly_above_with__1.jpg',
  frozen_bank_c: '/grounds/Lucid_Origin_frozen_tundra_landscape_from_directly_above_with__2.jpg',
  dense_block_ground_a: '/grounds/cc0/dirt_1.png',
  dense_block_ground_b: '/grounds/cc0/dirt_2.png',
  dense_block_ground_c: '/grounds/cc0/grass00.png',
  green_courtyard_a: '/grounds/cc0/tileable_grass_00.png',
  green_courtyard_b: '/grounds/cc0/tileable_grass_01.png',
  forest_canopy_a: '/grounds/cc0/grass00.png',
  forest_canopy_b: '/grounds/cc0/tileable_grass_01.png',
  academy_courtyard_a: '/grounds/cc0/tileable_grass_00.png',
  academy_courtyard_b: '/grounds/cc0/dirt_1.png',
  stone_route_a: '/ground/stone_bricks_atlas_4x4.png',
  stone_route_b: '/grounds/Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_3.jpg',
  stone_route_trim: '/grounds/image.png',
  event_surface_a: '/grounds/gemini-2.5-flash-image_isometric_hand-painted_fantasy_RPG_tile_texture_of_dark_cracked_dungeon_floor_ti-0.jpg',
  event_surface_b: '/grounds/image copy.png',
};

const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

const buildTerrainBlock = (coords, holes = []) => {
  if (!coords || coords.length < 3) return null;

  const pts = coords.map(([lat, lng]) => gpsToGame(lat, lng));
  const contour = pts.map((p) => new THREE.Vector2(p.x, p.z));
  const holePts = (holes || []).map((hole) => hole.map(([lat, lng]) => gpsToGame(lat, lng)));
  const holeContours = holePts.map((hole) => hole.map((p) => new THREE.Vector2(p.x, p.z)));
  const triangulationPts = [pts, ...holePts].flat();
  const allPts = triangulationPts;

  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  } catch (_) {
    return null;
  }
  if (!faces || faces.length === 0) return null;

  let minX = Infinity;
  let minZ = Infinity;
  allPts.forEach((p) => {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
  });

  const positions = new Float32Array(faces.length * 9);
  const uvs = new Float32Array(faces.length * 6);
  let vi = 0;
  let ui = 0;
  const tileSize = 100.0;

  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const p = triangulationPts[idx];
      positions[vi++] = p.x;
      positions[vi++] = 0.55;
      positions[vi++] = p.z;
      uvs[ui++] = (p.x - minX) / tileSize;
      uvs[ui++] = (p.z - minZ) / tileSize;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
};

const buildTerrainBlockFromGeoJson = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  const [outer, ...holes] = boundaryGeoJson.coordinates;
  const outerCoords = outer.map(([lng, lat]) => [lat, lng]);
  const holeCoords = holes.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  return buildTerrainBlock(outerCoords, holeCoords);
};

const DongMask = ({ currentDong, elevation }) => {
  const geo = useMemo(() => {
    if (!currentDong?.coords || currentDong.coords.length < 3) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(currentDong.coords[0][0], currentDong.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < currentDong.coords.length; i += 1) {
        const p = gpsToGame(currentDong.coords[i][0], currentDong.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (_) {
      return null;
    }
  }, [currentDong]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={3}>
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        stencilWrite
        stencilRef={1}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilPass={THREE.ReplaceStencilOp}
      />
    </mesh>
  );
};

const CityBlockContent = ({
  texturePaths,
  zoneData,
  dbPartitions,
  currentDong,
  elevation,
  showOriginalBlocks = true,
  showSectorBlocks = true,
}) => {
  const textures = useTexture(texturePaths);

  useEffect(() => {
    const texArray = Array.isArray(textures) ? textures : [textures];
    texArray.forEach((t) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
      t.needsUpdate = true;
    });
  }, [textures]);

  const textureIndexByPath = useMemo(() => {
    const map = new Map();
    texturePaths.forEach((path, index) => map.set(path, index));
    return map;
  }, [texturePaths]);

  const blocks = useMemo(() => {
    const result = [];
    const texCount = Array.isArray(textures) ? textures.length : 1;

    if (showOriginalBlocks && zoneData?.zones) {
      const blockCats = Object.keys(zoneData.zones).filter(
        (cat) => cat !== 'sectors' && cat !== 'road_major' && cat !== 'road_minor' && cat !== 'unexplored',
      );

      blockCats.forEach((cat) => {
        const features = zoneData.zones[cat] || [];
        features.forEach((feature) => {
          if (feature.type !== 'polygon' || !feature.coords?.length) return;
          const geo = buildTerrainBlock(feature.coords, feature.holes);
          if (!geo) return;
          const seed = Math.abs(feature.coords[0][0] * 12345 + feature.coords[0][1] * 67890);
          const texIdx = Math.floor(seed) % texCount;
          result.push({ geo, texIdx, order: 3 });
        });
      });
    }

    if (showSectorBlocks) {
      if (dbPartitions?.length > 0) {
        dbPartitions.forEach((partition, idx) => {
          const geo = buildTerrainBlockFromGeoJson(partition.boundary_geojson);
          if (!geo) return;
          const texturePath = TEXTURE_PROFILE_MAP[partition.texture_profile] || '/grounds/image.png';
          const texIdx = textureIndexByPath.has(texturePath)
            ? textureIndexByPath.get(texturePath)
            : idx % texCount;
          result.push({ geo, texIdx, order: 5 });
        });
      } else if (zoneData?.zones?.sectors) {
        const sectors = zoneData.zones.sectors || [];
        sectors.forEach((feature, idx) => {
          if (feature.type !== 'polygon' || !feature.coords?.length) return;
          const geo = buildTerrainBlock(feature.coords, feature.holes);
          if (!geo) return;
          const seed = Math.abs(feature.coords[0][0] * 99999 + feature.coords[0][1] * 11111 + idx);
          const texIdx = (Math.floor(seed) + 7) % texCount;
          result.push({ geo, texIdx, order: 5 });
        });
      }
    }

    return result;
  }, [showOriginalBlocks, showSectorBlocks, zoneData, dbPartitions, textures, textureIndexByPath]);

  return (
    <group>
      <DongMask currentDong={currentDong} elevation={elevation + 0.01} />
      <group position={[0, elevation, 0]}>
        {blocks.map((block, index) => (
          <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
            <meshStandardMaterial
              map={Array.isArray(textures) ? textures[block.texIdx] : textures}
              transparent={false}
              opacity={1}
              stencilWrite
              stencilRef={1}
              stencilFunc={THREE.EqualStencilFunc}
              side={THREE.DoubleSide}
              roughness={1}
              metalness={0}
              depthWrite
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const CityBlockOverlay = ({
  zoneData,
  currentDong,
  visible = true,
  elevation = 0.05,
  showOriginalBlocks = true,
  showSectorBlocks = true,
}) => {
  const [texturePaths, setTexturePaths] = useState([]);
  const [dbPartitions, setDbPartitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchPaths = async () => {
      try {
        const dbTexturePaths = [...Object.values(TEXTURE_PROFILE_MAP)];
        const res = await worldApi.getBlockTextures();
        const serverPaths = Array.isArray(res.data) ? res.data : [];
        const merged = Array.from(new Set([...dbTexturePaths, ...serverPaths]));
        if (!cancelled) {
          setTexturePaths(merged.length > 0 ? merged : ['/grounds/image.png']);
        }
      } catch (_) {
        if (!cancelled) {
          setTexturePaths(Array.from(new Set([...Object.values(TEXTURE_PROFILE_MAP)])));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPaths();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPartitions = async () => {
      if (!showSectorBlocks || !currentDong?.id) {
        setDbPartitions([]);
        return;
      }

      try {
        const res = await worldApi.getDongPartitions(currentDong.id);
        if (!cancelled) {
          setDbPartitions(Array.isArray(res.data) ? res.data : []);
        }
      } catch (_) {
        if (!cancelled) {
          setDbPartitions([]);
        }
      }
    };

    fetchPartitions();
    return () => {
      cancelled = true;
    };
  }, [showSectorBlocks, currentDong?.id]);

  if (!visible || loading || texturePaths.length === 0) return null;

  return (
    <CityBlockContent
      texturePaths={texturePaths}
      zoneData={zoneData}
      dbPartitions={dbPartitions}
      currentDong={currentDong}
      elevation={elevation}
      showOriginalBlocks={showOriginalBlocks}
      showSectorBlocks={showSectorBlocks}
    />
  );
};

export default CityBlockOverlay;
