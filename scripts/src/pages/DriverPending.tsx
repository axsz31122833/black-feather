import React from 'react'
import { useNavigate } from 'react-router-dom'
export default function DriverPending() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] text-white p-8 max-w-md text-center">
        <div className="text-xl font-bold mb-2" style={{ color: '#FFD700' }}>待審核</div>
        <div className="text-sm mb-4">您的帳號正在面試審核中，請耐心等候管理員通知。</div>
        <button onClick={() => navigate('/driver/login')} className="px-4 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>返回登入</button>
      </div>
    </div>
  )
}
