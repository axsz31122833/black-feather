import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'
import webpush from 'npm:web-push'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
webpush.setVapidDetails('mailto:ops@bf.example', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export default async function handler(req: Request): Promise<Response> {
  try {
    const { user_id, title, body } = await req.json()
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', user_id)
    let sent = 0, failed = 0
    for (const s of (subs || [])) {
      try {
        await webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth }
        } as any, JSON.stringify({ title: title || 'BF 推播', body: body || '通知' }))
        sent++
      } catch (_) {
        failed++
      }
    }
    return new Response(JSON.stringify({ sent, failed }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

