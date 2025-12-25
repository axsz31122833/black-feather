import React from 'react';
import MapView from './MapView';

// MapSelector: 輕量包裝，沿用環境變數選擇提供者的 MapView
// 與現有 MapView 介面一致，僅將 props 轉送
export default function MapSelector({
  center,
  markers = [],
  polylines = [],
  onClick,
  zoom = 14
}) {
  return (
    <MapView
      center={center}
      markers={markers}
      polylines={polylines}
      onClick={onClick}
      zoom={zoom}
    />
  );
}