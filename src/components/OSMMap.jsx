import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import maplibregl from 'maplibre-gl';

// 簡易哈弗賽公式計算兩點距離（公尺）
function haversineDistanceMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

async function withRetryFetch(url, options = {}, tries = 3, delay = 400) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      // 短暫退避
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw lastErr;
}

function MapLibreView({ center, pickupCoord, dropoffCoord }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // already init
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [center.lng, center.lat],
      zoom: 13
    });
    mapRef.current = map;
    return () => {
      try { map.remove(); } catch (_) {}
      mapRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickupCoord) {
      if (!pickupMarkerRef.current) pickupMarkerRef.current = new maplibregl.Marker({ color: '#22c55e' });
      pickupMarkerRef.current.setLngLat([pickupCoord.lng, pickupCoord.lat]).addTo(map);
      map.setCenter([pickupCoord.lng, pickupCoord.lat]);
    }
    if (dropoffCoord) {
      if (!dropoffMarkerRef.current) dropoffMarkerRef.current = new maplibregl.Marker({ color: '#ef4444' });
      dropoffMarkerRef.current.setLngLat([dropoffCoord.lng, dropoffCoord.lat]).addTo(map);
    }
  }, [pickupCoord, dropoffCoord]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView([center.lat, center.lng], 13);
  }, [center, map]);
  return null;
}

/**
 * OSMMap - 以 OpenStreetMap（Leaflet）為主、MapLibre 為備援的地圖元件
 */
export default function OSMMap({
  center = { lat: 25.033964, lng: 121.564468 },
  pickupCoord,
  dropoffCoord,
  onRouteUpdate,
  onTileError,
}) {
  const [fallbackMapLibre, setFallbackMapLibre] = useState(false);
  const [routeLine, setRouteLine] = useState(null);
  const [message, setMessage] = useState('');

  // 嘗試使用 OSRM 計算路線；失敗則用哈弗賽連線作為備援
  useEffect(() => {
    const calcRoute = async () => {
      if (!pickupCoord || !dropoffCoord) {
        setRouteLine(null);
        onRouteUpdate?.({ distanceMeters: 0, durationSeconds: 0, polylinePath: [] });
        return;
      }
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoord.lng},${pickupCoord.lat};${dropoffCoord.lng},${dropoffCoord.lat}?overview=full&geometries=geojson`;
        const data = await withRetryFetch(url, {}, 2, 500);
        const route = data.routes?.[0];
        if (route) {
          const coords = route.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];
          setRouteLine(coords);
          onRouteUpdate?.({
            distanceMeters: route.distance || haversineDistanceMeters(pickupCoord, dropoffCoord),
            durationSeconds: route.duration || 0,
            polylinePath: coords
          });
          return;
        }
        throw new Error('OSRM 無有效回傳');
      } catch (err) {
        console.warn('OSRM 路線計算失敗，改用哈弗賽距離：', err);
        const dist = haversineDistanceMeters(pickupCoord, dropoffCoord);
        const estDuration = (dist / 1000) / 30 * 60; // 假設時速 30km -> 分鐘
        setRouteLine([pickupCoord, dropoffCoord]);
        onRouteUpdate?.({ distanceMeters: dist, durationSeconds: estDuration, polylinePath: [pickupCoord, dropoffCoord] });
      }
    };
    calcRoute();
  }, [pickupCoord, dropoffCoord, onRouteUpdate]);

  const handleTileError = () => {
    setFallbackMapLibre(true);
    setMessage('地圖載入中斷，已自動切換備援地圖。');
    onTileError?.();
  };

  if (fallbackMapLibre) {
    return (
      <div className="w-full h-full">
        <MapLibreView center={center} pickupCoord={pickupCoord} dropoffCoord={dropoffCoord} />
        {message && <div className="text-xs text-yellow-400 mt-2">{message}</div>}
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          eventHandlers={{ tileerror: handleTileError }}
        />
        <RecenterMap center={center} />
        {pickupCoord && (
          <CircleMarker center={[pickupCoord.lat, pickupCoord.lng]} radius={10} pathOptions={{ color: '#22c55e' }} />
        )}
        {dropoffCoord && (
          <CircleMarker center={[dropoffCoord.lat, dropoffCoord.lng]} radius={10} pathOptions={{ color: '#ef4444' }} />
        )}
        {routeLine && routeLine.length >= 2 && (
          <Polyline positions={routeLine.map(p => [p.lat, p.lng])} pathOptions={{ color: '#0ea5e9', weight: 4 }} />
        )}
      </MapContainer>
      {message && <div className="text-xs text-yellow-400 mt-2">{message}</div>}
    </div>
  );
}