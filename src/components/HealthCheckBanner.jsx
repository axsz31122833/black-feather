import React, { useEffect, useState } from 'react';

import invokeWithAuth from '../lib/functions';
import { useApp } from '../contexts/AppContext';

function HealthCheckBanner() {
  const { user } = useApp();
  const [status, setStatus] = useState('checking'); // 'ok' | 'error' | 'checking'
  const [message, setMessage] = useState('正在檢查後端連線...');

  const checkHealth = async () => {
    setStatus('checking');
    setMessage('正在檢查後端連線...');
    try {
      const data = await invokeWithAuth('get-driver-status', {});
      // 成功即可視為後端健康，顯示統計摘要
      const stats = data?.data?.stats || data?.stats || null;
      if (stats) {
        if (user?.role === 'admin') {
          setMessage(`連線正常：司機總數 ${stats.total}，閒置 ${stats.idle}，忙碌 ${stats.busy}，離線 ${stats.offline}`);
        } else {
          // 非管理員不顯示統計數字
          setMessage('連線正常');
        }
      } else {
        setMessage('連線正常');
      }
      setStatus('ok');
    } catch (err) {
      // 備援：改用本地 API
      try {
        // 備援策略：
        // - 本地開發（hostname 為 localhost）一律使用 3001 本地 API 伺服器
        // - 線上環境使用 VITE_PUBLIC_APP_URL（若未設定則不嘗試備援）
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // 在本機環境也優先使用 VITE_PUBLIC_APP_URL，若未設定則退回 3001
        const baseUrl = isLocalhost
          ? (import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:3001')
          : (import.meta.env.VITE_PUBLIC_APP_URL || '');
        const localPath = baseUrl ? `${baseUrl}/drivers/status` : '';
        if (!localPath) throw new Error('未設定本地或公開備援 URL');
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        const resp = await fetch(`${API_BASE_URL}/api/health`);
        if (!resp.ok) throw new Error(`本地 API 失敗 (${resp.status})`);
        const json = await resp.json();
        const stats = json?.data || null;
        if (stats) {
          if (user?.role === 'admin') {
            setMessage(`本地連線正常：司機總數 ${stats.total}，閒置 ${stats.idle}，忙碌 ${stats.busy}，離線 ${stats.offline}`);
          } else {
            setMessage('本地連線正常');
          }
          setStatus('ok');
        } else {
          setStatus('error');
          setMessage('Supabase 與本地 API 無法取得狀態');
        }
      } catch (fallbackErr) {
        setStatus('error');
        setMessage(`後端連線異常：${err.message || '未知錯誤'}；備援失敗：${fallbackErr.message || '未知錯誤'}`);
      }
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const bg = status === 'ok' ? 'bg-green-600/40' : status === 'error' ? 'bg-red-600/40' : 'bg-yellow-600/40';
  const border = status === 'ok' ? 'border-green-500/50' : status === 'error' ? 'border-red-500/50' : 'border-yellow-500/50';

  return (
    <div className={`w-full p-2 text-sm text-white ${bg} border-b ${border}`}> 
      <div className="container mx-auto flex items-center justify-between">
        <span>{message}</span>
        <button
          onClick={checkHealth}
          className="px-3 py-1 rounded bg-black/30 hover:bg-black/40 border border-white/20"
        >
          重新檢查
        </button>
      </div>
    </div>
  );
}

export default HealthCheckBanner;



