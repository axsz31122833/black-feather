import axios from 'axios';

// 建立 axios 實例並自動附帶 bf_auth_token
// 基底 URL 選擇策略：
// 1) 優先使用 VITE_PUBLIC_APP_URL（若有且非空字串）
// 2) 若在 Vite 開發環境（預設 5174），強制退回本機後端 http://localhost:3001
// 3) 其他情況使用 window.location.origin，或在無 window 時退回本機 3001
const envBase = (typeof import.meta !== 'undefined' && import.meta.env)
  ? (import.meta.env.VITE_API_BASE_URL || '')
  : '';
const defaultDevApi = 'http://localhost:3001';
let baseURL;
if (envBase && envBase.trim() !== '') {
  baseURL = envBase.trim();
} else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  baseURL = defaultDevApi;
} else if (typeof window !== 'undefined' && window.location) {
  baseURL = window.location.origin;
} else {
  baseURL = defaultDevApi;
}

const api = axios.create({ baseURL, timeout: 15000 });

// 在開發時提示實際使用的 API 基底位址，有助於排查 Failed to fetch
try {
  const isDev = String(import.meta?.env?.DEV || '').toLowerCase() === 'true';
  if (isDev) console.info('[API] baseURL =', baseURL);
} catch (_) {}

api.interceptors.request.use((config) => {
  const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase();
  const devEnabled = devBypass === 'true' || devBypass === '1' || devBypass === 'yes';
  // 在免登入測試模式下，移除 Authorization 標頭
  if (devEnabled) {
    if (config.headers && 'Authorization' in config.headers) {
      delete config.headers['Authorization'];
    }
    return config;
  }
  const token = localStorage.getItem('bf_auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 可導向登入或提示
      console.warn('未授權或 Token 失效');
    }
    return Promise.reject(err);
  }
);

export default api;



