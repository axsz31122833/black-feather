import React, { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sendOpsEvent } from '../utils/ops'
import { useAuthStore } from '../stores/auth'

export default function GlobalMonitor() {
  const { user } = useAuthStore()
  const lastErrorTs = useRef<number>(0)
  const lastPerfSent = useRef<boolean>(false)

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const now = Date.now()
      if (now - lastErrorTs.current < 10000) return
      lastErrorTs.current = now
      const payload = {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
        user_id: user?.id || null
      }
      ;(async () => {
        try {
          await sendOpsEvent('frontend_error', user?.id || null, payload)
        } catch {}
      })()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const now = Date.now()
      if (now - lastErrorTs.current < 10000) return
      lastErrorTs.current = now
      const payload = {
        reason: typeof e.reason === 'string' ? e.reason : String(e.reason),
        user_id: user?.id || null
      }
      ;(async () => {
        try {
          await sendOpsEvent('frontend_error', user?.id || null, payload)
        } catch {}
      })()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection as any)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection as any)
    }
  }, [user?.id])

  useEffect(() => {
    if (lastPerfSent.current) return
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        const payload = {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadTime: Math.round(nav.loadEventEnd - nav.startTime),
          firstByte: Math.round(nav.responseStart - nav.requestStart)
        }
        ;(async () => {
          try {
            await sendOpsEvent('frontend_perf', user?.id || null, payload)
          } catch {}
        })()
      }
    } catch {}
    lastPerfSent.current = true
  }, [user?.id])

  return null
}
