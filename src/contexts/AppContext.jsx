import { airtable } from '../lib/airtable';
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import invokeWithAuth from '../lib/functions';
import taxiApi from '../lib/taxi-api-client';
import api from '../lib/api';
import io from 'socket.io-client';

const AppContext = createContext();

const initialState = {
  user: null,
  drivers: [],
  orders: [],
  currentOrder: null,
  subscriptions: [],
  loading: false,
  error: null,
  stats: {
    totalDrivers: 0,
    idleDrivers: 0,
    busyDrivers: 0,
    offlineDrivers: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0
  }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_DRIVERS':
      return { 
        ...state, 
        drivers: action.payload,
        stats: {
          ...state.stats,
          totalDrivers: action.payload.length,
          idleDrivers: action.payload.filter(d => d.status === 'idle').length,
          busyDrivers: action.payload.filter(d => d.status === 'busy').length,
          offlineDrivers: action.payload.filter(d => d.status === 'offline').length
        }
      };
    
    case 'UPDATE_DRIVER_STATUS':
      return {
        ...state,
        drivers: state.drivers.map(driver =>
          driver.phone === action.payload.phone
            ? {
                ...driver,
                status: action.payload.status ?? driver.status,
                // 正規�R座�"�a��援 latitude/longitude �� lat/lng
                lat: (action.payload.lat ?? action.payload.latitude ?? driver.lat ?? null),
                lng: (action.payload.lng ?? action.payload.longitude ?? driver.lng ?? null)
              }
            : driver
        )
      };
    
    case 'SET_ORDERS':
      return { 
        ...state, 
        orders: action.payload,
        stats: {
          ...state.stats,
          totalOrders: action.payload.length,
          completedOrders: action.payload.filter(o => o.status === 'completed').length,
          pendingOrders: action.payload.filter(o => o.status === 'pending').length
        }
      };
    
    case 'ADD_ORDER':
      return {
        ...state,
        orders: [action.payload, ...state.orders],
        currentOrder: action.payload
      };
    
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.payload.id ? action.payload : order
        ),
        currentOrder: state.currentOrder?.id === action.payload.id ? action.payload : state.currentOrder
      };
    
    case 'SET_CURRENT_ORDER':
      return { ...state, currentOrder: action.payload };
    
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // �"x�9"�"��試�~ bf_auth_token ��}x使���&�9��&9
  useEffect(() => {
    try {
      let token = localStorage.getItem('bf_auth_token');
      // �9�"�模式�&��"��&��a�9��� token�R�0!根�a��墒�`�"�建�9�!���ƶ��!�! JWT
      const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase();
      const devEnabled = devBypass === 'true' || devBypass === '1' || devBypass === 'yes';
      if (!token && devEnabled) {
        const role = import.meta.env.VITE_DEV_USER_ROLE || 'passenger';
        const phone = import.meta.env.VITE_DEV_USER_PHONE || '0912345678';
        const name = import.meta.env.VITE_DEV_USER_NAME || '�9�"��&測試';
        const nowSec = Math.floor(Date.now() / 1000);
        const header = { alg: 'HS256', typ: 'JWT' };
        const payload = {
          iss: 'black-feather-taxi',
          iat: nowSec,
          exp: nowSec + 60 * 60 * 24 * 7,
          sub: String(phone),
          role,
          name
        };
        const toB64Url = (obj) => {
          const json = JSON.stringify(obj);
          const b64 = btoa(json);
          return b64.replace(/=+/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        };
        token = `${toB64Url(header)}.${toB64Url(payload)}.dev`;
        try {
          localStorage.setItem('bf_auth_token', token);
          localStorage.setItem('bf_user_profile', JSON.stringify({
            userId: String(phone),
            phone: String(phone),
            name,
            role,
            permissions: {
              role,
              can_access_admin: role === 'admin',
              can_access_driver: role === 'driver' || role === 'admin',
              can_access_passenger: true
            }
          }));
        } catch (_) {}
      }
      if (!token) return;
      const parts = token.split('.');
      if (parts.length !== 3) return;
      // 解�~� JWT payload��base64url -> base64�0
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad === 2) b64 += '==';
      else if (pad === 3) b64 += '=';
      else if (pad === 1) b64 += '===';
      const payloadJson = atob(b64);
      const payload = JSON.parse(payloadJson || '{}');
      const now = Math.floor(Date.now() / 1000);
      if (!payload?.exp || payload.exp < now) {
        // �}�Sx�R�!��9"�&�"�
        localStorage.removeItem('bf_auth_token');
        localStorage.removeItem('bf_user_profile');
        return;
      }
      // ���&�使���S��S�快�&�
      let cached = null;
      try {
        const raw = localStorage.getItem('bf_user_profile');
        cached = raw ? JSON.parse(raw) : null;
      } catch (_) {}
      const role = cached?.role || payload?.role || 'passenger';
      const name = cached?.name || payload?.name || '使���&';
      const userData = {
        userId: cached?.userId || payload?.sub || null,
        phone: cached?.phone || null,
        name,
        role,
        permissions: cached?.permissions || {
          role,
          can_access_admin: role === 'admin',
          can_access_driver: role === 'driver' || role === 'admin',
          can_access_passenger: true
        },
        token
      };
      // �&�S��a�S��S0使���&�"恢復
      if (!state.user) {
        loginUser(userData).catch(() => {});
      }
    } catch (_) {}
  }, []);
  // �Ɲ�9�R Supabase 即�"���
  useEffect(() => {
    let socketCleanup = () => {};

    // �������`�:�    const ordersSubscription = { unsubscribe: () => {} };

    // ���司�x�9��&9�`�:�    const driversSubscription = { unsubscribe: () => {} };

    // �9� Supabase �S�設�a�� channel 建�9失�"�R使�� Socket.IO �R�"
    try {
      const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const socket = io(url, { transports: ['websocket'] });
      dispatch({ type: 'SET_SOCKET', payload: socket });
      socket.on('connect', () => {
        // 可�S�此���R鬣�a�9��&9
      });
      socket.on('order_created', (order) => {
        dispatch({ type: 'ADD_ORDER', payload: order });
      });
      socket.on('order_completed', (order) => {
        dispatch({ type: 'UPDATE_ORDER', payload: order });
      });
      socket.on('order_status_update', (order) => {
        dispatch({ type: 'UPDATE_ORDER', payload: order });
      });
      socket.on('driver_status_update', ({ phone, status }) => {
        dispatch({ type: 'UPDATE_DRIVER_STATUS', payload: { phone, status } });
      });
      socketCleanup = () => {
        try { socket.disconnect(); } catch (_) {}
      };
    } catch (_) {}

    return () => {
      socketCleanup();
    };
  }, []);

  // �`��0司�x�9��&9
  // ??????
  const loadDrivers = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await api.get('/drivers/status');
      const drivers = res?.data?.drivers || [];
      const formatted = drivers.map(d => ({
        phone: d.phone,
        name: d.name || d.phone,
        status: d.status,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        rating: d.rating ?? null,
        vehicle: d.vehicle || undefined
      }));
      dispatch({ type: 'SET_DRIVERS', payload: formatted });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message || '????????' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };
  // �`��0���
  const loadOrders = async (phone = null) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      let query = supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (phone) {
        query = query.eq('passenger_phone', phone);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // 格式�R�!�"以符���0�端�Sx�S:�a結�9
      const formattedOrders = (data || []).map(order => ({
        id: order.id,
        passengerPhone: order.passenger_phone,
        driverPhone: order.driver_phone,
        driverName: order.driver_name || '�S��� �&�',
        pickup: order.pickup_location,
        dropoff: order.dropoff_location,
        status: order.status,
        estimatedPrice: order.estimated_price || 0,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        // �"咹���9����S��RSupabase �:��0�可蒽��此�位�R預�""�0
        review: order.review ?? null
      }));
      
      dispatch({ type: 'SET_ORDERS', payload: formattedOrders });
    } catch (error) {
      // REST �R�"�a�S��S��9�"�伺�S��"�
      try {
        let res;
        if (phone) {
          res = await api.get(`/user/${phone}/orders`);
        } else {
          res = await api.get('/orders/all');
        }
        const list = res?.data?.data || [];
        const formatted = list.map(order => ({
          id: order.id,
          passengerPhone: order.passengerPhone ?? order.passenger_phone,
          driverPhone: order.driverPhone ?? order.driver_phone,
          driverName: order.driverName ?? order.driver_name ?? '�S��� �&�',
          pickup: order.pickup ?? order.pickup_location,
          dropoff: order.dropoff ?? order.dropoff_location,
          status: order.status,
          estimatedPrice: order.estimatedPrice ?? order.estimated_price ?? 0,
          createdAt: order.createdAt ?? order.created_at,
          completedAt: order.completedAt ?? order.completed_at,
          // �S��S座�"��!路�a估��位���9����S��0
          pickupLat: order.pickupLat ?? order.pickup_lat ?? null,
          pickupLng: order.pickupLng ?? order.pickup_lng ?? null,
          dropoffLat: order.dropoffLat ?? order.dropoff_lat ?? null,
          dropoffLng: order.dropoffLng ?? order.dropoff_lng ?? null,
          estimatedDistanceMeters: order.estimatedDistanceMeters ?? order.estimated_distance_meters ?? null,
          estimatedDurationSeconds: order.estimatedDurationSeconds ?? order.estimated_duration_seconds ?? null,
          // �"咹���9����S��0
          review: order.review ?? null
        }));
        dispatch({ type: 'SET_ORDERS', payload: formatted });
      } catch (restErr) {
        dispatch({ type: 'SET_ERROR', payload: restErr.message || error.message });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 叫�`
  const requestRide = async (rideData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await taxiApi.requestRide({
        passengerPhone: rideData.passengerPhone,
        pickup: rideData.pickup,
        dropoff: rideData.dropoff,
        pickup_lat: rideData.pickup_lat,
        pickup_lng: rideData.pickup_lng,
        dropoff_lat: rideData.dropoff_lat,
        dropoff_lng: rideData.dropoff_lng,
        estimated_distance_meters: rideData.estimated_distance_meters,
        estimated_duration_seconds: rideData.estimated_duration_seconds,
        estimated_price: rideData.estimated_price,
        service_type: rideData.service_type,
        deposit: rideData.deposit,
        notes: rideData.notes,
        map_provider: rideData.map_provider
      });

      // �&�容 Edge / REST �:~�!0結�9
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      const driver = responseData.driver || null;
      
      if (!ride || !ride.id) {
        throw new Error('API��:~�"��a格式�R�誤');
      }
      
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone ?? ride.passengerPhone,
        driverPhone: ride.driver_phone ?? ride.driverPhone,
        driverName: driver?.name ?? ride.driverName ?? '�S��� �&�',
        pickup: ride.pickup_location ?? ride.pickup,
        dropoff: ride.dropoff_location ?? ride.dropoff,
        status: ride.status,
        estimatedPrice: (ride.estimated_price ?? ride.estimatedPrice ?? 0),
        deposit: ride.deposit ?? rideData.deposit ?? 0,
        serviceType: ride.service_type ?? rideData.service_type ?? 'standard',
        estimatedDistanceMeters: ride.estimated_distance_meters ?? ride.estimatedDistanceMeters,
        estimatedDurationSeconds: ride.estimated_duration_seconds ?? ride.estimatedDurationSeconds,
        pickupLat: ride.pickup_lat ?? ride.pickupLat,
        pickupLng: ride.pickup_lng ?? ride.pickupLng,
        dropoffLat: ride.dropoff_lat ?? ride.dropoffLat,
        dropoffLng: ride.dropoff_lng ?? ride.dropoffLng,
        notes: ride.notes ?? rideData.notes ?? '',
        createdAt: ride.created_at ?? ride.createdAt
      };
      
      dispatch({ type: 'ADD_ORDER', payload: formattedOrder });
      return { order: formattedOrder, driver: driver };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // �R�Ɛ���
  const completeRide = async (orderId, driverPhone) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      // 使�� taxiApi�R以便�S� Edge 失�"�"�"x�� REST �R�"
      const data = await taxiApi.completeRide({ rideId: orderId, driverPhone });
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      
      if (!ride || !ride.id) {
        throw new Error('API��:~�"��a格式�R�誤');
      }
      
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone,
        driverPhone: ride.driver_phone,
        driverName: (ride.driver_name ?? state.currentOrder?.driverName ?? ride.driverName ?? '�S��� �&�'),
        pickup: ride.pickup_location ?? ride.pickup,
        dropoff: ride.dropoff_location ?? ride.dropoff,
        status: ride.status,
        estimatedPrice: (ride.estimated_price ?? ride.estimatedPrice ?? 0),
        createdAt: ride.created_at ?? ride.createdAt,
        completedAt: ride.completed_at ?? ride.completedAt
      };
      
      dispatch({ type: 'UPDATE_ORDER', payload: formattedOrder });
      // ��試�!司�x�9��&9設�� idle���9���司�x端觸�"��0
      try {
        await taxiApi.updateDriverStatus({ status: 'idle', phone: driverPhone || state.user?.phone });
      } catch (_) {}
      return { order: formattedOrder };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // �:�������9��&9���a���0�R�9��aaccepted/enroute/arrived/completed/cancelled
  const updateRideStatus = async ({ orderId, nextStatus, driverPhone, passengerPhone }) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await taxiApi.updateRideStatus({ rideId: orderId, nextStatus, driverPhone, passengerPhone });
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      if (!ride || !ride.id) throw new Error('API��:~�"��a格式�R�誤');
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone ?? ride.passengerPhone,
        driverPhone: ride.driver_phone ?? ride.driverPhone,
        driverName: (ride.driver_name ?? state.currentOrder?.driverName ?? ride.driverName ?? '�S��� �&�'),
        pickup: ride.pickup_location ?? ride.pickup,
        dropoff: ride.dropoff_location ?? ride.dropoff,
        status: ride.status,
        estimatedPrice: (ride.estimated_price ?? ride.estimatedPrice ?? 0),
        createdAt: ride.created_at ?? ride.createdAt,
        completedAt: ride.completed_at ?? ride.completedAt
      };
      dispatch({ type: 'UPDATE_ORDER', payload: formattedOrder });
      // 依�9��&9��試�R步司�x�9��&9
      if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        try { await taxiApi.updateDriverStatus({ status: 'idle', phone: driverPhone || state.user?.phone }); } catch (_) {}
      } else if (nextStatus === 'accepted' || nextStatus === 'enroute' || nextStatus === 'arrived') {
        try { await taxiApi.updateDriverStatus({ status: 'busy', phone: driverPhone || state.user?.phone }); } catch (_) {}
      }
      return { order: formattedOrder };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // �:���司�x�9��&9
  const updateDriverStatus = async (phone, status) => {
    try {
      // ����保護�a Edge Function �:������S��S帶 bf_auth_token�0�:失�"�0!走 REST �R�"
      await taxiApi.updateDriverStatus({ status, phone });
      
      dispatch({ type: 'UPDATE_DRIVER_STATUS', payload: { phone, status } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  // �"��&����ƶ
    // ?????(?? email+password ?????????)
  const loginUser = async (emailOrUser, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      let user = null;
      if (typeof emailOrUser === 'string') {
        const email = emailOrUser.trim();
        const users = await airtable.get('Users', { email });
        user = users.find(u => u.password === password);
        if (!user) throw new Error('???????');
      } else if (emailOrUser && typeof emailOrUser === 'object') {
        user = emailOrUser; // ????????
      } else {
        throw new Error('???????');
      }

      dispatch({ type: 'SET_USER', payload: user });

      // ??????????
      if (user.role === 'admin') {
        await loadDrivers();
        await loadOrders();
      } else {
        await loadOrders(user.phone);
      }

      return user;

    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // �"��!��a�&�"��0��S0�"��&��!�`�R��試�"��!� Supabase Auth�R並�&� �S��S�����
  // ??:????????,??????????
  const logout = async () => {
    try {
      // ???? Supabase Auth,??????? signOut;?????,????
    } catch (_) {}

    // ??????
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_ORDERS', payload: [] });
    dispatch({ type: 'SET_DRIVERS', payload: [] });
    dispatch({ type: 'SET_CURRENT_ORDER', payload: null });
    dispatch({ type: 'CLEAR_ERROR' });

    // ?? Socket(???)
    try { socketCleanup?.(); } catch (_) {}

    // ??????
    try {
      localStorage.removeItem('bf_auth_token');
      localStorage.removeItem('bf_user_profile');
      // ??????????? sessionStorage ??
      const keys = Object.keys(sessionStorage || {});
      keys.forEach(k => { if (k.startsWith('bf_')) { try { sessionStorage.removeItem(k); } catch (_) {} } });
    } catch (_) {}
  };

  // �&�"��R�誤
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };
  // ?????(Airtable)
  const registerUser = async (data) => {
    const newUser = await airtable.create('Users', data);
    dispatch({ type: 'SET_USER', payload: newUser });
    return newUser;
  };

  // ????(Airtable)
  const saveOrder = async (order) => {
    const created = await airtable.create('Orders', order);
    return created;
  };

  // ??? Context ??
  const value = {
    ...state,
    loadDrivers,
    loadOrders,
    requestRide,
    completeRide,
    updateRideStatus,
    updateDriverStatus,
    loginUser,
    registerUser,
    saveOrder,
    logout,
    clearError
  };


  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};











