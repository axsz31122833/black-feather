import React, { useEffect } from 'react'

export default function ManifestManager() {
  useEffect(() => {
    const path = window.location.pathname || '/'
    let href = '/manifest-passenger.json'
    let theme = '#D4AF37'
    if (path.startsWith('/driver')) {
      href = '/manifest-driver.json'
      theme = '#C0C0C0'
    } else if (path.startsWith('/admin')) {
      href = '/manifest-admin.json'
      theme = '#000000'
    }
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'manifest')
      document.head.appendChild(link)
    }
    link.setAttribute('href', href)
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', theme)
  }, [])
  return null
}
