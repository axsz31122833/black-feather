import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    
      "airtable": path.resolve(__dirname, "./src/shims/airtable-mock.js"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,
    // 明確允許隧道網域存取（Vite 的 host check）
    allowedHosts: [
      'hughes-remains-answers-harvest.trycloudflare.com',
      /^.*\.trycloudflare\.com$/,
      /^.*\.loca\.lt$/
    ],
    // HMR 設定：預設使用 ws（本機），如需隧道環境可設 USE_WSS=1 啟用 wss
    hmr: (process.env.USE_WSS === '1'
      ? { clientPort: 443, protocol: 'wss' }
      : undefined),
        proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // 供 vite preview 使用（手機端經隧道需允許域名）
  build: { assetsInlineLimit: 0 },
  preview: {
   host: true,
   port: 5174,
   strictPort: true,
   cors: true,
   allowedHosts: [
      // 目前使用的臨時隧道域名
      'customs-along-history-profession.trycloudflare.com',
      'dat-laden-coordinated-theta.trycloudflare.com',
      // 通配允許所有 trycloudflare 與 loca.lt 子域名
      /^.*\.trycloudflare\.com$/,
      /^.*\.loca\.lt$/
    ]
  }
})



