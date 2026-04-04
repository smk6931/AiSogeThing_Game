import { useEffect, useRef, useState } from 'react';
import worldApi from '@api/world';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';

const DEFAULT_STATE = {
  gps: { lat: GIS_ORIGIN.lat, lng: GIS_ORIGIN.lng },
  currentDong: null,
  dbRegion: null,
  currentPartition: null,
};

const distanceSqMeters = (a, b) => {
  const dx = (a.lng - b.lng) * LNG_TO_M;
  const dz = (a.lat - b.lat) * LAT_TO_M;
  return (dx * dx) + (dz * dz);
};

export function useCurrentRegionInfo(playerPositionRef, enabled = true) {
  const [state, setState] = useState(DEFAULT_STATE);
  const lastFetchGpsRef = useRef(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const update = async () => {
      const pos = playerPositionRef?.current;
      if (!pos || inFlightRef.current) return;

      const gps = {
        lat: GIS_ORIGIN.lat - ((pos.z || 0) / LAT_TO_M),
        lng: GIS_ORIGIN.lng + ((pos.x || 0) / LNG_TO_M),
      };

      setState((prev) => {
        if (prev.gps.lat === gps.lat && prev.gps.lng === gps.lng) return prev;
        return { ...prev, gps };
      });

      if (lastFetchGpsRef.current && distanceSqMeters(lastFetchGpsRef.current, gps) < (25 * 25)) {
        return;
      }

      inFlightRef.current = true;
      try {
        const response = await worldApi.getCurrentRegion(gps.lat, gps.lng);
        if (!mountedRef.current) return;
        const payload = response.data || {};
        lastFetchGpsRef.current = gps;
        setState({
          gps,
          currentDong: payload.current_dong || null,
          dbRegion: payload.db_region || null,
          currentPartition: payload.current_partition || null,
        });
      } catch (_) {
        if (!mountedRef.current) return;
      } finally {
        inFlightRef.current = false;
      }
    };

    update();
    const interval = window.setInterval(update, 800);
    return () => window.clearInterval(interval);
  }, [enabled, playerPositionRef]);

  return state;
}

export default useCurrentRegionInfo;
