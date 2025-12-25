import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// 讀取環境變數
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let auth;

function ensureFirebase() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return { app, auth };
}

// 建立 recaptcha（Invisible 或顯示式，這裡用顯示式以利測試）
export function createRecaptcha(containerId) {
  const { auth } = ensureFirebase();
  if (!containerId) throw new Error('Missing recaptcha container id');
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: () => {},
  });
  return verifier;
}

// 發送 OTP
export async function sendFirebaseOtp(phone, recaptchaVerifier) {
  const { auth } = ensureFirebase();
  if (!phone) throw new Error('缺少手機號碼');
  if (!recaptchaVerifier) throw new Error('缺少 RecaptchaVerifier');
  const confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
  return confirmationResult; // 需保存以供 confirm(code)
}

export default ensureFirebase;