import React, { useEffect } from 'react'
import { env } from '../config/env'
import { supabase } from '../lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushInit() {
  useEffect(() => {
    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
        if (!env.VAPID_PUBLIC_KEY) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (Notification.permission === 'default') {
          await Notification.requestPermission().catch(()=>{})
        }
        if (Notification.permission !== 'granted') return
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(env.VAPID_PUBLIC_KEY)
        })
        const raw = sub.toJSON() as any
        const endpoint: string = raw.endpoint
        const p256dh: string = raw.keys?.p256dh || ''
        const auth: string = raw.keys?.auth || ''
        if (endpoint && p256dh && auth) {
          await supabase.from('push_subscriptions').upsert({
            user_id: user.id,
            endpoint, p256dh, auth
          }, { onConflict: 'endpoint' } as any)
        }
      } catch {}
    })()
  }, [])
  return null
}
