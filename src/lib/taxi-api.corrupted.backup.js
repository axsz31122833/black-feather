import React, { createContext, useContext, useReducer, useEffect } from 'react';
import invokeWithAuth from '../lib/functions';
import taxiApi from '../lib/taxi-api';
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
                // 正規化座標：支援 latitude/longitude 或 lat/lng
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

  // 啟動時嘗試從 bf_auth_token 還原使用者狀態
  useEffect(() => {
    try {
      let token = localStorage.getItem('bf_auth_token');
      // 開發模式免登入：若無 token，則根據環境變數建立假用戶與假 JWT
      const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase();
      const devEnabled = devBypass === 'true' || devBypass === '1' || devBypass === 'yes';
      if (!token && devEnabled) {
        const role = import.meta.env.VITE_DEV_USER_ROLE || 'passenger';
        const phone = import.meta.env.VITE_DEV_USER_PHONE || '0912345678';
        const name = import.meta.env.VITE_DEV_USER_NAME || '開發者測試';
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
      // 解析 JWT payload（base64url -> base64）
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad === 2) b64 += '==';
      else if (pad === 3) b64 += '=';
      else if (pad === 1) b64 += '===';
      const payloadJson = atob(b64);
      const payload = JSON.parse(payloadJson || '{}');
      const now = Math.floor(Date.now() / 1000);
      if (!payload?.exp || payload.exp < now) {
        // 過期，自動清除
        localStorage.removeItem('bf_auth_token');
        localStorage.removeItem('bf_user_profile');
        return;
      }
      // 優先使用本地快照
      let cached = null;
      try {
        const raw = localStorage.getItem('bf_user_profile');
        cached = raw ? JSON.parse(raw) : null;
      } catch (_) {}
      const role = cached?.role || payload?.role || 'passenger';
      const name = cached?.name || payload?.name || '使用者';
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
      // 僅在尚未有使用者時恢復
      if (!state.user) {
        loginUser(userData).catch(() => {});
      }
    } catch (_) {}
  }, []);
  // 初始化 Supabase 即時訂閱
  useEffect(() => {
    let socketCleanup = () => {};

    // 訂閱訂單變更    const ordersSubscription = { unsubscribe: () => {} };

    // 訂閱司機狀態變更    const driversSubscription = { unsubscribe: () => {} };

    // 若 Supabase 未設定或 channel 建立失敗，使用 Socket.IO 後備
    try {
      const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const socket = io(url, { transports: ['websocket'] });
      dispatch({ type: 'SET_SOCKET', payload: socket });
      socket.on('connect', () => {
        // 可在此記錄連線狀態
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

  // 加載司機狀態
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
  // 加載訂單
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
      
      // 格式化資料以符合前端期望的結構
      const formattedOrders = (data || []).map(order => ({
        id: order.id,
        passengerPhone: order.passenger_phone,
        driverPhone: order.driver_phone,
        driverName: order.driver_name || '未分配',
        pickup: order.pickup_location,
        dropoff: order.dropoff_location,
        status: order.status,
        estimatedPrice: order.estimated_price || 0,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        // 評價（若存在，Supabase 目前可能無此欄位，預留）
        review: order.review ?? null
      }));
      
      dispatch({ type: 'SET_ORDERS', payload: formattedOrders });
    } catch (error) {
      // REST 後備：本地開發伺服器
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
          driverName: order.driverName ?? order.driver_name ?? '未分配',
          pickup: order.pickup ?? order.pickup_location,
          dropoff: order.dropoff ?? order.dropoff_location,
          status: order.status,
          estimatedPrice: order.estimatedPrice ?? order.estimated_price ?? 0,
          createdAt: order.createdAt ?? order.created_at,
          completedAt: order.completedAt ?? order.completed_at,
          // 地圖座標與路線估算欄位（若存在）
          pickupLat: order.pickupLat ?? order.pickup_lat ?? null,
          pickupLng: order.pickupLng ?? order.pickup_lng ?? null,
          dropoffLat: order.dropoffLat ?? order.dropoff_lat ?? null,
          dropoffLng: order.dropoffLng ?? order.dropoff_lng ?? null,
          estimatedDistanceMeters: order.estimatedDistanceMeters ?? order.estimated_distance_meters ?? null,
          estimatedDurationSeconds: order.estimatedDurationSeconds ?? order.estimated_duration_seconds ?? null,
          // 評價（若存在）
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

  // 叫車
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

      // 兼容 Edge / REST 回應結構
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      const driver = responseData.driver || null;
      
      if (!ride || !ride.id) {
        throw new Error('API返回數據格式錯誤');
      }
      
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone ?? ride.passengerPhone,
        driverPhone: ride.driver_phone ?? ride.driverPhone,
        driverName: driver?.name ?? ride.driverName ?? '未分配',
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

  // 完成訂單
  const completeRide = async (orderId, driverPhone) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      // 使用 taxiApi，以便在 Edge 失敗時啟用 REST 後備
      const data = await taxiApi.completeRide({ rideId: orderId, driverPhone });
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      
      if (!ride || !ride.id) {
        throw new Error('API返回數據格式錯誤');
      }
      
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone,
        driverPhone: ride.driver_phone,
        driverName: (ride.driver_name ?? state.currentOrder?.driverName ?? ride.driverName ?? '未分配'),
        pickup: ride.pickup_location ?? ride.pickup,
        dropoff: ride.dropoff_location ?? ride.dropoff,
        status: ride.status,
        estimatedPrice: (ride.estimated_price ?? ride.estimatedPrice ?? 0),
        createdAt: ride.created_at ?? ride.createdAt,
        completedAt: ride.completed_at ?? ride.completedAt
      };
      
      dispatch({ type: 'UPDATE_ORDER', payload: formattedOrder });
      // 嘗試將司機狀態設為 idle（若為司機端觸發）
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

  // 更新訂單狀態（通用），例如：accepted/enroute/arrived/completed/cancelled
  const updateRideStatus = async ({ orderId, nextStatus, driverPhone, passengerPhone }) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await taxiApi.updateRideStatus({ rideId: orderId, nextStatus, driverPhone, passengerPhone });
      const responseData = data?.data || data;
      const ride = responseData.ride || responseData.order;
      if (!ride || !ride.id) throw new Error('API返回數據格式錯誤');
      const formattedOrder = {
        id: ride.id,
        passengerPhone: ride.passenger_phone ?? ride.passengerPhone,
        driverPhone: ride.driver_phone ?? ride.driverPhone,
        driverName: (ride.driver_name ?? state.currentOrder?.driverName ?? ride.driverName ?? '未分配'),
        pickup: ride.pickup_location ?? ride.pickup,
        dropoff: ride.dropoff_location ?? ride.dropoff,
        status: ride.status,
        estimatedPrice: (ride.estimated_price ?? ride.estimatedPrice ?? 0),
        createdAt: ride.created_at ?? ride.createdAt,
        completedAt: ride.completed_at ?? ride.completedAt
      };
      dispatch({ type: 'UPDATE_ORDER', payload: formattedOrder });
      // 依狀態嘗試同步司機狀態
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

  // 更新司機狀態
  const updateDriverStatus = async (phone, status) => {
    try {
      // 經由受保護的 Edge Function 更新（需攜帶 bf_auth_token）；失敗則走 REST 後備
      await taxiApi.updateDriverStatus({ status, phone });
      
      dispatch({ type: 'UPDATE_DRIVER_STATUS', payload: { phone, status } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  // 登入用戶
  const loginUser = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // 使用從邊緣函數驗證過的用戶數據
      dispatch({ type: 'SET_USER', payload: userData });
      
      // 根據角色加載相應數據
      if (userData.role === 'admin') {
        await loadDrivers();
        await loadOrders();
      } else {
        await loadOrders(userData.phone);
      }
      
      return userData;
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 登出：清除所有登入資訊，嘗試登出 Supabase Auth，並清理本地存儲
  // ??:????????,??????????
  // 發送/重寄 OTP（Edge Function: send-otp）
  sendOtp = async ({ phone, name, role }) => {
    try {
      const result = await invokeWithAuth('send-otp', { phone, name, role });
      return result;
    } catch (error) {
      console.warn('Edge Function send-otp ??,?? REST ??');
      try {
        const res = await api.post('/auth/send-otp', { phone, name, role });
        return res.data; // { success, data: { phone, expiresAt, ttlMinutes, devCode } }
      } catch (restErr) {
        console.error('REST ????????:', restErr);
        throw restErr;
      }
    }
  };

  // 註冊（Edge Function: user-register）
  register = async ({ phone, name, role }) => {
    try {
      const result = await invokeWithAuth('user-register', { phone, name, role });
      return result;
    } catch (error) {
      console.error('????:', error);
      throw error;
    }
  };

  // 驗證手機（Edge Function: verify-phone）
  verifyPhone = async ({ phone, verificationCode }) => {
    try {
      const result = await invokeWithAuth('verify-phone', { phone, verificationCode });
      return result;
    } catch (error) {
      console.warn('Edge Function verify-phone ??,?? REST ??');
      try {
        const res = await api.post('/auth/verify-phone', { phone, verificationCode });
        return res.data; // { success, data: { phone, verified: true } }
      } catch (restErr) {
        console.error('REST ???????:', restErr);
        throw restErr;
      }
    }
  };

  // 提交訂單評價（星級與評論文字）
  submitOrderReview = async ({ orderId, rating, comment, byPhone }) => {
    // ???? Edge Functions(???????? REST)
    try {
      const payload = { orderId, rating, comment, by_phone: byPhone };
      const result = await invokeWithAuth('orders-review', payload);
      return result;
    } catch (error) {
      console.warn('Edge Function orders-review ??,?? REST ??');
      try {
        const res = await api.post('/orders/review', { orderId, rating, comment, by_phone: byPhone });
        return res.data; // { success, order, driver, driverAvgRating, message }
      } catch (restErr) {
        console.error('REST ?????????:', restErr);
        throw restErr;
      }
    }
  };

  // 实时订阅数据变化
  subscribeToRides = (callback) => {
    // Supabase ???;?? AppContext ? socket ?? (order_created/order_status_update)
    return { unsubscribe() { /* no-op */ } };
  };

  // 实时订阅司机状态变化
  subscribeToDrivers = (callback) => {
    // Supabase ???;?? AppContext ? socket ?? (driver_status_update)
    return { unsubscribe() { /* no-op */ } };
  };

  // 取消订阅
  unsubscribe = (subscription) => {
    try {
      if (!subscription) return false;
      if (typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
        return true;
      }
      // TODO: ????? Supabase ????
      return true;
    } catch (err) {
      console.warn('??????:', err);
      return false;
    }
  };
}
const taxiApiClient = new TaxiAPI();
export default taxiApiClient;



