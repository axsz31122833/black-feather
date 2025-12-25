import { auth, db } from '../../firebaseConfig.js';
import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';

function phoneToEmail(phone) {
  const normalized = String(phone || '').replace(/\s+/g, '');
  // 允許本地 09 開頭或 E.164（+8869...）
  const local = /^09\d{8}$/;
  const e164 = /^\+\d{7,}$/;
  if (!local.test(normalized) && !e164.test(normalized)) {
    throw new Error('手機號格式錯誤，請使用 09xxxxxxxx 或 E.164 格式');
  }
  return `${normalized}@bf.local`;
}

async function ensureUniquePhone(phone) {
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error('此手機號已註冊');
  }
}

export async function registerWithPhonePassword({ phone, password, role = 'passenger', name = '', remember = true }) {
  const email = phoneToEmail(phone);
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await ensureUniquePhone(phone);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  if (name) {
    try { await updateProfile(user, { displayName: name }); } catch (_) {}
  }
  const uid = user.uid;
  await setDoc(doc(db, 'users', uid), {
    uid,
    role,
    phone,
    name: name || user.displayName || '',
    status: role === 'driver' ? 'idle' : 'active',
    createdAt: serverTimestamp(),
  });
  // 取得 ID Token 作為 bf_auth_token
  const token = await user.getIdToken();
  const profile = {
    userId: uid,
    phone,
    name: name || user.displayName || '',
    role,
    permissions: {
      role,
      can_access_admin: role === 'admin',
      can_access_driver: role === 'driver' || role === 'admin',
      can_access_passenger: true,
    },
  };
  try {
    localStorage.setItem('bf_auth_token', token);
    localStorage.setItem('bf_user_profile', JSON.stringify(profile));
  } catch (_) {}
  return { success: true, data: { token, ...profile } };
}

export async function loginWithPhonePassword({ phone, password, remember = true }) {
  const email = phoneToEmail(phone);
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const token = await user.getIdToken();
  // 讀取 Firestore 使用者文件以獲取 role/name
  let role = 'passenger';
  let name = user.displayName || '';
  try {
    // 以 phone 查找使用者
    const q = query(collection(db, 'users'), where('phone', '==', phone));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      role = d.role || role;
      name = d.name || name || '';
    }
  } catch (_) {}
  const profile = {
    userId: user.uid,
    phone,
    name,
    role,
    permissions: {
      role,
      can_access_admin: role === 'admin',
      can_access_driver: role === 'driver' || role === 'admin',
      can_access_passenger: true,
    },
  };
  try {
    localStorage.setItem('bf_auth_token', token);
    localStorage.setItem('bf_user_profile', JSON.stringify(profile));
  } catch (_) {}
  return { success: true, data: { token, ...profile } };
}

export async function logoutFirebase() {
  try { await signOut(auth); } catch (_) {}
  try {
    localStorage.removeItem('bf_auth_token');
    localStorage.removeItem('bf_user_profile');
  } catch (_) {}
  return { success: true };
}

export function getCurrentUser() {
  const u = auth.currentUser;
  return u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null;
}

export default {
  registerWithPhonePassword,
  loginWithPhonePassword,
  logoutFirebase,
  getCurrentUser,
};