import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { connectWs, send, on } from '../lib/wsClient';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const { user } = useApp();
  const [online, setOnline] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const markersRef = useRef(new Map()); // key: phone, value: { lat, lng, orderId }
  const watchIdRef = useRef(null);
  const tickerRef = useRef(null);

  // Connect WS when user is ready
  useEffect(() => {
    if (!user) return;
    const role = user.role || 'passenger';
    connectWs(role);
    // also notify server of role explicitly
    send('register', { role });

    // Passenger: listen for driver marker updates
    const offMarker = on('passenger:update_driver_marker', (data) => {
      const { phone, lat, lng, orderId } = data || {};
      if (!phone || typeof lat !== 'number' || typeof lng !== 'number') return;
      markersRef.current.set(String(phone), { lat, lng, orderId });
    });

    // Passenger: meter started notification (optional)
    const offMeter = on('passenger:meter_started', ({ orderId }) => {
      try {
        console.log('[ws] passenger meter started for order', orderId);
      } catch (_) {}
    });

    return () => {
      offMarker?.();
      offMeter?.();
    };
  }, [user]);

  // Driver: start/stop geolocation watch and periodic reporting
  useEffect(() => {
    if (!user || user.role !== 'driver') return;

    function startWatch() {
      if (!('geolocation' in navigator)) {
        console.warn('[ws] Geolocation not supported');
        return;
      }
      try {
        watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
          const { latitude, longitude } = pos?.coords || {};
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            setLastLocation({ lat: latitude, lng: longitude, at: Date.now() });
          }
        }, (err) => {
          console.warn('[ws] geolocation error', err);
        }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });
      } catch (e) {
        console.warn('[ws] geolocation start failed', e);
      }
    }

    function stopWatch() {
      try {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (_) {}
      watchIdRef.current = null;
    }

    function startTicker() {
      stopTicker();
      tickerRef.current = setInterval(() => {
        if (!online) return;
        const loc = lastLocation;
        if (!loc) return;
        const payload = {
          phone: user.phone || user.phoneNumber || user.mobile || user.userId || undefined,
          lat: Number(loc.lat),
          lng: Number(loc.lng),
        };
        send('driver:update_location', payload);
      }, 3000);
    }

    function stopTicker() {
      if (tickerRef.current) {
        try { clearInterval(tickerRef.current); } catch (_) {}
        tickerRef.current = null;
      }
    }

    if (online) {
      startWatch();
      startTicker();
    } else {
      stopTicker();
      stopWatch();
    }

    return () => {
      stopTicker();
      stopWatch();
    };
  }, [online, user, lastLocation]);

  const value = useMemo(() => ({
    online,
    setOnline,
    lastLocation,
    getMarkers: () => markersRef.current,
    startMeter: (orderId) => {
      if (!orderId) return false;
      return send('driver:meter_start', { orderId });
    },
  }), [online, lastLocation]);

  return (
    <WsContext.Provider value={value}>{children}</WsContext.Provider>
  );
}

export function useWs() {
  return useContext(WsContext);
}