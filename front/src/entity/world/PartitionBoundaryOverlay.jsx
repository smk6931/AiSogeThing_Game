import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import worldApi from '@api/world';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

const gpsToXZ = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

const toEdgeKey = (a, b) => {
  const p1 = `${Math.round(a[0] * 1e6)},${Math.round(a[1] * 1e6)}`;
  const p2 = `${Math.round(b[0] * 1e6)},${Math.round(b[1] * 1e6)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
};

const buildWallFromSegment = (startLngLat, endLngLat, height, thickness) => {
  const p1 = gpsToXZ(startLngLat[1], startLngLat[0]);
  const p2 = gpsToXZ(endLngLat[1], endLngLat[0]);
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.05) return null;

  const angle = Math.atan2(dz, dx);
  const boxGeo = new THREE.BoxGeometry(len, height, thickness);
  boxGeo.translate(len / 2, height / 2, 0);
  boxGeo.rotateY(-angle);
  boxGeo.translate(p1.x, 0, p1.z);
  return boxGeo;
};

const buildWallsFromRing = (ring, height = 28, thickness = 7.5) => {
  if (!ring || ring.length < 2) return [];
  const geos = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const geo = buildWallFromSegment(ring[i], ring[i + 1], height, thickness);
    if (geo) geos.push(geo);
  }
  return geos;
};

const buildPartitionBoundaryGeometry = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  const geos = [];
  for (const ring of boundaryGeoJson.coordinates) {
    geos.push(...buildWallsFromRing(ring));
  }
  return geos.length ? mergeGeometries(geos, false) : null;
};

const buildGroupBoundaryGeometry = (partitions, height = 42, thickness = 12) => {
  const edgeMap = new Map();

  partitions.forEach((partition) => {
    const boundary = partition.boundary_geojson;
    if (!boundary?.coordinates?.length) return;
    boundary.coordinates.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const start = ring[i];
        const end = ring[i + 1];
        const key = toEdgeKey(start, end);
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { count: 1, start, end });
        } else {
          edgeMap.get(key).count += 1;
        }
      }
    });
  });

  const geos = [];
  edgeMap.forEach((edge) => {
    if (edge.count !== 1) return;
    const geo = buildWallFromSegment(edge.start, edge.end, height, thickness);
    if (geo) geos.push(geo);
  });

  return geos.length ? mergeGeometries(geos, false) : null;
};

const PartitionBoundaryOverlay = ({
  currentDong,
  playerPositionRef,
  visibleMicro = false,
  visibleGroup = false,
  highlightCurrentGroup = true,
  elevation = 0.42,
}) => {
  const [partitions, setPartitions] = useState([]);
  const [currentGroupKey, setCurrentGroupKey] = useState(null);
  const [currentPartitionKey, setCurrentPartitionKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if ((!visibleMicro && !visibleGroup && !highlightCurrentGroup) || !currentDong?.id) {
        setPartitions([]);
        return;
      }

      try {
        const res = await worldApi.getDongPartitions(currentDong.id);
        if (!cancelled) setPartitions(Array.isArray(res.data) ? res.data : []);
      } catch (_) {
        if (!cancelled) setPartitions([]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visibleMicro, visibleGroup, highlightCurrentGroup, currentDong?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentRegion = async () => {
      if ((!visibleMicro && !visibleGroup && !highlightCurrentGroup) || !currentDong?.id || !playerPositionRef?.current?.position) {
        setCurrentGroupKey(null);
        setCurrentPartitionKey(null);
        return;
      }

      try {
        const { x, z } = playerPositionRef.current.position;
        const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
        const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);
        const res = await worldApi.getCurrentRegion(lat, lng);
        if (cancelled) return;
        const partition = res.data?.current_partition || null;
        setCurrentGroupKey(partition?.group_key || null);
        setCurrentPartitionKey(partition?.partition_key || null);
      } catch (_) {
        if (!cancelled) {
          setCurrentGroupKey(null);
          setCurrentPartitionKey(null);
        }
      }
    };

    loadCurrentRegion();
    const interval = setInterval(loadCurrentRegion, 700);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visibleMicro, visibleGroup, highlightCurrentGroup, currentDong?.id, playerPositionRef]);

  const microMeshes = useMemo(
    () =>
      partitions
        .map((partition) => ({
          id: partition.id,
          partitionKey: partition.partition_key,
          groupKey: partition.group_key,
          geometry: buildPartitionBoundaryGeometry(partition.boundary_geojson),
        }))
        .filter((entry) => entry.geometry),
    [partitions]
  );

  const groupMeshes = useMemo(() => {
    const grouped = new Map();
    partitions.forEach((partition) => {
      if (!partition.group_key) return;
      if (!grouped.has(partition.group_key)) grouped.set(partition.group_key, []);
      grouped.get(partition.group_key).push(partition);
    });

    return Array.from(grouped.entries())
      .map(([groupKey, groupPartitions]) => ({
        groupKey,
        geometry: buildGroupBoundaryGeometry(groupPartitions),
      }))
      .filter((entry) => entry.geometry);
  }, [partitions]);

  if (!visibleMicro && !visibleGroup && !highlightCurrentGroup) return null;

  const currentMicroMeshes = microMeshes.filter((entry) => entry.partitionKey === currentPartitionKey);
  const currentGroupMicroMeshes = microMeshes.filter(
    (entry) => entry.groupKey && entry.groupKey === currentGroupKey && entry.partitionKey !== currentPartitionKey
  );

  return (
    <group name="partition-boundaries" position={[0, elevation, 0]}>
      {visibleMicro &&
        microMeshes.map((entry) => (
          <mesh key={`partition-boundary-${entry.id}`} geometry={entry.geometry} renderOrder={13}>
            <meshBasicMaterial color="#f7d56b" transparent opacity={0.24} depthWrite={false} depthTest={false} />
          </mesh>
        ))}

      {visibleGroup &&
        groupMeshes.map((entry) => (
          <mesh key={`partition-group-${entry.groupKey}`} geometry={entry.geometry} renderOrder={14}>
            <meshBasicMaterial
              color={entry.groupKey === currentGroupKey ? '#67e8d6' : '#8bd8ff'}
              transparent
              opacity={entry.groupKey === currentGroupKey ? 0.82 : 0.48}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        ))}

      {highlightCurrentGroup &&
        currentGroupMicroMeshes.map((entry) => (
          <mesh key={`partition-current-group-${entry.id}`} geometry={entry.geometry} renderOrder={15}>
            <meshBasicMaterial color="#67e8d6" transparent opacity={0.46} depthWrite={false} depthTest={false} />
          </mesh>
        ))}

      {highlightCurrentGroup &&
        currentMicroMeshes.map((entry) => (
          <mesh key={`partition-current-micro-${entry.id}`} geometry={entry.geometry} renderOrder={16}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.96} depthWrite={false} depthTest={false} />
          </mesh>
        ))}
    </group>
  );
};

export default PartitionBoundaryOverlay;
