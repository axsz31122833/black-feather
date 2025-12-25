export function getRole() {
  try {
    const v = localStorage.getItem('bf_role')
    return v || 'passenger'
  } catch { return 'passenger' }
}

export function getPhone() {
  try { return localStorage.getItem('bf_auth_phone') || '' } catch { return '' }
}

export function isAdmin() {
  const adminEnv = import.meta.env.VITE_ADMIN_PHONE || ''
  const phone = getPhone()
  return adminEnv && phone && phone === adminEnv
}
