import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import worldApi from '@api/world';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

const gpsToXZ = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

const buildWallsFromRing = (ring, height = 28, thickness = 7.5) => {
  if (!ring || ring.length < 2) return [];

  const geos = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    const p1 = gpsToXZ(lat1, lng1);
    const p2 = gpsToXZ(lat2, lng2);

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.05) continue;

    const angle = Math.atan2(dz, dx);
    const boxGeo = new THREE.BoxGeometry(len, height, thickness);
    boxGeo.translate(len / 2, height / 2, 0);
    boxGeo.rotateY(-angle);
    boxGeo.translate(p1.x, 0, p1.z);
    geos.push(boxGeo);
  }

  return geos;
};

const buildPartitionBoundaryGeometry = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;

  const geos = [];
  for (const ring of boundaryGeoJson.coordinates) {
    geos.push(...buildWallsFromRing(ring));
  }

  if (geos.length === 0) return null;
  return mergeGeometries(geos, false);
};

const PartitionBoundaryOverlay = ({
  currentDong,
  playerPositionRef,
  visible = true,
  elevation = 0.42,
}) => {
  const [partitions, setPartitions] = useState([]);
  const [currentGroupKey, setCurrentGroupKey] = useState(null);
  const [currentPartitionKey, setCurrentPartitionKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!visible || !currentDong?.id) {
        setPartitions([]);
        return;
      }

      try {
        const res = await worldApi.getDongPartitions(currentDong.id);
        if (!cancelled) {
          setPartitions(Array.isArray(res.data) ? res.data : []);
        }
      } catch (_) {
        if (!cancelled) {
          setPartitions([]);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, currentDong?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentRegion = async () => {
      if (!visible || !currentDong?.id || !playerPositionRef?.current?.position) {
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
  }, [visible, currentDong?.id, playerPositionRef]);

  const boundaryMeshes = useMemo(() => {
    return partitions
      .map((partition) => ({
        id: partition.id,
        partitionKey: partition.partition_key,
        groupKey: partition.group_key,
        geometry: buildPartitionBoundaryGeometry(partition.boundary_geojson),
      }))
      .filter((entry) => entry.geometry);
  }, [partitions]);

  if (!visible || boundaryMeshes.length === 0) return null;

  const currentPartitionMeshes = boundaryMeshes.filter((entry) => entry.partitionKey === currentPartitionKey);
  const currentGroupMeshes = boundaryMeshes.filter(
    (entry) => entry.groupKey && entry.groupKey === currentGroupKey && entry.partitionKey !== currentPartitionKey
  );
  const otherMeshes = boundaryMeshes.filter(
    (entry) => entry.partitionKey !== currentPartitionKey && entry.groupKey !== currentGroupKey
  );

  return (
    <group name="partition-boundaries" position={[0, elevation, 0]}>
      {otherMeshes.map((entry) => (
        <mesh key={`partition-boundary-${entry.id}`} geometry={entry.geometry} renderOrder={13}>
          <meshBasicMaterial
            color="#f7d56b"
            transparent
            opacity={0.28}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
      {currentGroupMeshes.map((entry) => (
        <mesh key={`partition-group-boundary-${entry.id}`} geometry={entry.geometry} renderOrder={14}>
          <meshBasicMaterial
            color="#67e8d6"
            transparent
            opacity={0.55}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
      {currentPartitionMeshes.map((entry) => (
        <mesh key={`partition-current-boundary-${entry.id}`} geometry={entry.geometry} renderOrder={15}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.95}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default PartitionBoundaryOverlay;
