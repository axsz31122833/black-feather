// 動態載入 Google Maps JavaScript API
// 使用方式：await loadGoogleMaps({ apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, libraries: ['places'] })

let loadingPromise = null;

export function loadGoogleMaps({ apiKey, libraries = [] } = {}) {
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const libs = libraries.length > 0 ? `&libraries=${libraries.join(',')}` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${libs}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps 載入失敗'));
      }
    };
    script.onerror = () => reject(new Error('Google Maps Script 加載失敗'));
    document.head.appendChild(script);
  });

  return loadingPromise;
}