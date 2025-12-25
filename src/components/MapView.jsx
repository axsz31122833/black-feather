import React, { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { toast } from '../hooks/use-toast';
// Leaflet 將作為最後的後備
let Leaflet = null;
async function loadLeaflet() {
  if (Leaflet) return Leaflet;
  const L = await import('leaflet');
  try { await import('leaflet/dist/leaflet.css'); } catch (_) {}
  Leaflet = L;
  return L;
}

// Mapbox GL JS 動態載入（僅在需要時）
async function loadMapbox() {
  if (typeof window !== 'undefined' && window.mapboxgl) return window.mapboxgl;
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.async = true;
    script.onload = () => resolve(window.mapboxgl);
    script.onerror = () => reject(new Error('Mapbox 載入失敗'));
    document.head.appendChild(script);
  });
}

// 通用地圖元件：顯示乘客/司機標記與路線
// props:
// - center: { lat, lng }
// - markers: [{ id, position: { lat, lng }, label }]
// - polylines: [{ id, path: [{ lat, lng }], color }]
// - onClick: (latLng) => void  // 點地圖回傳座標
// - zoom: number

function MapView({ center, markers = [], polylines = [], onClick, zoom = 14 }) {
  const mapRef = useRef(null);
  const gmapRef = useRef(null);
  const overlaysRef = useRef({ markers: new Map(), polylines: new Map() });
  const modeRef = useRef('google'); // 'google' | 'mapbox'
  const mbMapRef = useRef(null);
  const lfMapRef = useRef(null);
  const leafletLibRef = useRef(null);

  useEffect(() => {
    let destroyed = false;
    async function init() {
      const prefer = (import.meta.env.VITE_MAP_PROVIDER || 'google').toLowerCase();
      if (prefer === 'mapbox') {
        try {
          const mapboxgl = await loadMapbox();
          if (destroyed) return;
          mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
          const map = new mapboxgl.Map({
            container: mapRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [ (center?.lng ?? 121.564468), (center?.lat ?? 25.033964) ],
            zoom
          });
          mbMapRef.current = map;
          modeRef.current = 'mapbox';
          if (onClick) {
            map.on('click', (e) => {
              const lngLat = e.lngLat;
              onClick({ lat: lngLat.lat, lng: lngLat.lng });
            });
          }
          renderMarkersMapbox(mapboxgl);
          renderPolylinesMapbox(mapboxgl);
          return;
        } catch (e) {
          console.warn('Mapbox 載入失敗，改用 Google Maps', e);
        }
      }
      // Google Maps fallback
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          toast({ title: '地圖後備', description: 'Google Maps API key 缺失，已切換 Leaflet', variant: 'destructive' });
          throw new Error('Missing Google Maps API key');
        }
        const maps = await loadGoogleMaps({ apiKey, libraries: ['places'] });
        if (destroyed) return;
        const map = new maps.Map(mapRef.current, {
          center: center || { lat: 25.033964, lng: 121.564468 },
          zoom,
          disableDefaultUI: false
        });
        gmapRef.current = map;
        modeRef.current = 'google';
        if (onClick) {
          map.addListener('click', (e) => {
            onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          });
        }
        renderMarkers(window.google.maps);
        renderPolylines(window.google.maps);
      } catch (e) {
        console.warn('Google Maps 載入失敗，改用 Leaflet', e);
        toast({ title: '地圖後備', description: 'Google Maps 不可用，改用 Leaflet 地圖', variant: 'destructive' });
        // Leaflet 最終後備
        const L = await loadLeaflet();
        leafletLibRef.current = L;
        if (destroyed) return;
        const map = L.map(mapRef.current).setView([ (center?.lat ?? 25.033964), (center?.lng ?? 121.564468) ], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        mbMapRef.current = null;
        gmapRef.current = null;
        lfMapRef.current = map;
        modeRef.current = 'leaflet';
        if (onClick) {
          map.on('click', (e) => {
            onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }
        // Leaflet 覆蓋：建立初始 overlays（使用 overlaysRef 維持狀態）
        renderMarkersLeaflet();
        renderPolylinesLeaflet();
      }
    }
    init();
    return () => { destroyed = true; };
  }, []);

  useEffect(() => {
    if (modeRef.current === 'mapbox') {
      if (!mbMapRef.current || !window.mapboxgl) return;
      renderMarkersMapbox(window.mapboxgl);
    } else if (modeRef.current === 'google') {
      if (!gmapRef.current || !window.google?.maps) return;
      renderMarkers(window.google.maps);
    } else {
      // Leaflet：動態更新
      renderMarkersLeaflet();
    }
  }, [markers]);

  useEffect(() => {
    if (modeRef.current === 'mapbox') {
      if (!mbMapRef.current || !window.mapboxgl) return;
      renderPolylinesMapbox(window.mapboxgl);
    } else if (modeRef.current === 'google') {
      if (!gmapRef.current || !window.google?.maps) return;
      renderPolylines(window.google.maps);
    } else {
      // Leaflet：動態更新
      renderPolylinesLeaflet();
    }
  }, [polylines]);

  function renderMarkers(maps) {
    const map = gmapRef.current;
    const store = overlaysRef.current.markers;
    // 移除不存在的
    for (const [id, marker] of store.entries()) {
      if (!markers.find(m => m.id === id)) {
        marker.setMap(null);
        store.delete(id);
      }
    }
    // 新增或更新
    markers.forEach(m => {
      let marker = store.get(m.id);
      if (!marker) {
        marker = new maps.Marker({ position: m.position, map, label: m.label });
        store.set(m.id, marker);
      } else {
        marker.setPosition(m.position);
        if (m.label) marker.setLabel(m.label);
      }
    });
  }

  function renderMarkersMapbox(mb) {
    const map = mbMapRef.current;
    if (!map) return;
    const store = overlaysRef.current.markers;
    // 清除不存在的
    for (const [id, marker] of store.entries()) {
      if (!markers.find(m => m.id === id)) {
        marker.remove();
        store.delete(id);
      }
    }
    markers.forEach(m => {
      let marker = store.get(m.id);
      if (!marker) {
        marker = new mb.Marker().setLngLat([m.position.lng, m.position.lat]).addTo(map);
        store.set(m.id, marker);
      } else {
        marker.setLngLat([m.position.lng, m.position.lat]);
      }
    });
  }

  function renderPolylines(maps) {
    const map = gmapRef.current;
    const store = overlaysRef.current.polylines;
    for (const [id, poly] of store.entries()) {
      if (!polylines.find(p => p.id === id)) {
        poly.setMap(null);
        store.delete(id);
      }
    }
    polylines.forEach(p => {
      let poly = store.get(p.id);
      if (!poly) {
        poly = new maps.Polyline({ path: p.path, strokeColor: p.color || '#00aaff', strokeWeight: 4 });
        poly.setMap(map);
        store.set(p.id, poly);
      } else {
        poly.setPath(p.path);
        if (p.color) poly.setOptions({ strokeColor: p.color });
      }
    });
  }

  function renderPolylinesMapbox(mb) {
    const map = mbMapRef.current;
    if (!map) return;
    const store = overlaysRef.current.polylines;
    // 移除不存在的
    for (const [id, layerId] of store.entries()) {
      if (!polylines.find(p => p.id === id)) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(layerId)) map.removeSource(layerId);
        store.delete(id);
      }
    }
    polylines.forEach(p => {
      let layerId = store.get(p.id);
      const sourceData = {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: p.path.map(pt => [pt.lng, pt.lat])
          }
        }
      };
      if (!layerId) {
        layerId = `poly_${p.id}`;
        store.set(p.id, layerId);
        if (map.getSource(layerId)) map.removeSource(layerId);
        map.addSource(layerId, sourceData);
        map.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          paint: {
            'line-color': p.color || '#00aaff',
            'line-width': 4
          }
        });
      } else {
        const src = map.getSource(layerId);
        if (src) src.setData(sourceData.data);
      }
    });
  }

  function renderMarkersLeaflet() {
    const map = lfMapRef.current;
    const L = leafletLibRef.current;
    if (!map || !L) return;
    const store = overlaysRef.current.markers;
    // 移除不存在的
    for (const [id, marker] of store.entries()) {
      if (!markers.find(m => m.id === id)) {
        marker.remove();
        store.delete(id);
      }
    }
    // 新增或更新
    markers.forEach(m => {
      let marker = store.get(m.id);
      if (!marker) {
        marker = L.marker([m.position.lat, m.position.lng]).addTo(map);
        store.set(m.id, marker);
      } else {
        marker.setLatLng([m.position.lat, m.position.lng]);
      }
    });
  }

  function renderPolylinesLeaflet() {
    const map = lfMapRef.current;
    const L = leafletLibRef.current;
    if (!map || !L) return;
    const store = overlaysRef.current.polylines;
    // 移除不存在的
    for (const [id, poly] of store.entries()) {
      if (!polylines.find(p => p.id === id)) {
        poly.remove();
        store.delete(id);
      }
    }
    // 新增或更新
    polylines.forEach(p => {
      let poly = store.get(p.id);
      const latlngs = p.path.map(pt => [pt.lat, pt.lng]);
      if (!poly) {
        poly = L.polyline(latlngs, { color: p.color || '#00aaff', weight: p.strokeWeight || 4 }).addTo(map);
        store.set(p.id, poly);
      } else {
        poly.setLatLngs(latlngs);
        if (p.color || p.strokeWeight) poly.setStyle({ color: p.color || '#00aaff', weight: p.strokeWeight || 4 });
      }
    });
  }

  return (
    <div ref={mapRef} className="w-full h-full min-h-[320px] rounded-xl overflow-hidden border border-border/50" />
  );
}

export default MapView;