import { supabase } from './supabase';
import api from './api';

// ä»¥ Authorization Bearer è‡ªå‹•å¤¾å¸¶ bf_auth_token å‘¼å« Supabase Edge Function
export async function invokeWithAuth(functionName, body = {}) {
  const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase();
  const devEnabled = devBypass === 'true' || devBypass === '1' || devBypass === 'yes';
  const token = localStorage.getItem('bf_auth_token');
  // 在免登入模式下，優先使用本地 REST 端點，避免呼叫 Edge Functions
  if (devEnabled) {
    try {
      switch (functionName) {
        case 'phone-login': {
          const res = await api.post('/auth/login', body);
          return res.data;
        }
        case 'phone-login-pwd': {
          // 開發模式：手機+密碼登入
          const res = await api.post('/auth/login-pwd', body);
          return res.data;
        }
        case 'verify-phone': {
          const res = await api.post('/auth/verify-phone', body);
          return res.data;
        }
        case 'verify-firebase': {
          const res = await api.post('/auth/verify-firebase', body);
          return res.data;
        }
        case 'request-ride': {
          const res = await api.post('/ride/request', body);
          return res.data;
        }
        case 'update-ride-status': {
          const res = await api.post('/ride/update-status', body);
          return res.data;
        }
        case 'get-driver-status': {
          const res = await api.get('/drivers/status');
          return res.data;
        }
        case 'get-user-rides': {
          const phone = body?.phone || body?.passengerPhone;
          const url = phone ? `/user/${phone}/orders` : '/orders/all';
          const res = await api.get(url);
          return res.data;
        }
        case 'driver-heartbeat': {
          // 開發模式：接受多種欄位名稱，統一轉為 lat/lng 並包含 heading/speed
          const payload = {
            phone: body?.phone,
            status: body?.status,
            lat: (body?.lat ?? body?.latitude ?? null),
            lng: (body?.lng ?? body?.longitude ?? null),
            heading: body?.heading ?? null,
            speed: body?.speed ?? null
          };
          const res = await api.post('/driver-heartbeat', payload);
          return res.data;
        }
        case 'update-driver-status': {
          const phone = body?.phone;
          const res = await api.post(`/driver/${phone}/status`, { status: body?.status || 'idle' });
          return res.data;
        }
        case 'user-register': {
          // 開發模式：呼叫本地註冊端點
          const res = await api.post('/auth/register', body);
          return res.data;
        }
        default: {
          // 未特別處理的函式，一律回傳失敗以便前端採用其他流程
          return { success: false, message: `guest 模式未支援函式: ${functionName}` };
        }
      }
    } catch (localErr) {
      throw localErr;
    }
  }
  // 正常模式：呼叫 Edge Functions
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  } catch (err) {
    const msg = String(err?.message || err);
    if (functionName === 'phone-login') {
      try {
        const res = await api.post('/auth/login', body);
        return res.data;
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    if (/Supabase æœªè¨­å®š/.test(msg)) {
      throw new Error('å¾Œç«¯æœªè¨­å®šï¼šè«‹æä¾› VITE_SUPABASE_URL èˆ‡ VITE_SUPABASE_ANON_KEY ä¸¦é‡å•Ÿé–‹ç™¼ä¼ºæœå™¨');
    }
    throw err;
  }
}

export default invokeWithAuth;

