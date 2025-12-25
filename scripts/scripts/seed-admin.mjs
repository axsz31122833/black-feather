import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'

const phone = process.env.ADMIN_PHONE || process.env.VITE_ADMIN_PHONE || '0971827628'
const password = process.env.ADMIN_PASSWORD || 'axsz42233944'
const email = `u-${phone}@bf.example.com`

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError && !String(signUpError.message || '').toLowerCase().includes('already')) {
      console.error('Auth signUp error:', signUpError.message)
    }

    const { error: pErr } = await supabase
      .from('passengers')
      .upsert({ phone, name: phone }, { onConflict: 'phone' })
    if (pErr) console.error('passengers upsert error:', pErr.message)

    console.log('Admin seed completed for', phone)
  } catch (e) {
    console.error('Seed failed:', e)
    process.exit(1)
  }
}

main()
