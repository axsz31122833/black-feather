import { db } from '../../firebaseConfig.js';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { calculateFare } from './price.js';

export async function findUserDocIdByPhone(phone) {
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export async function createOrder(data) {
  const estimated_price = Number(data.estimated_price || calculateFare(
    data.estimated_distance_meters,
    data.estimated_duration_seconds,
    { service_type: data.service_type, deposit: data.deposit }
  ));
  const payload = {
    passenger_phone: data.passengerPhone,
    driver_phone: data.driverPhone || null,
    driver_name: data.driverName || '未分配',
    pickup_location: data.pickup,
    dropoff_location: data.dropoff,
    pickup_lat: data.pickup_lat ?? null,
    pickup_lng: data.pickup_lng ?? null,
    dropoff_lat: data.dropoff_lat ?? null,
    dropoff_lng: data.dropoff_lng ?? null,
    estimated_distance_meters: data.estimated_distance_meters ?? null,
    estimated_duration_seconds: data.estimated_duration_seconds ?? null,
    estimated_price,
    status: 'requested',
    service_type: data.service_type || 'standard',
    deposit: data.deposit || 0,
    notes: data.notes || '',
    map_provider: data.map_provider || 'leaflet',
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'orders'), payload);
  await updateDoc(ref, { id: ref.id });
  const docSnap = await getDoc(ref);
  return { id: ref.id, ...docSnap.data() };
}

export async function updateOrderStatus({ rideId, nextStatus, driverPhone, passengerPhone }) {
  const ref = doc(db, 'orders', rideId);
  const baseUpdate = { status: nextStatus };
  if (nextStatus === 'completed') {
    baseUpdate.completed_at = serverTimestamp();
  }
  if (driverPhone) baseUpdate.driver_phone = driverPhone;
  await updateDoc(ref, baseUpdate);
  const snap = await getDoc(ref);
  return { id: rideId, ...snap.data() };
}

export async function getOrdersByPassenger(phone) {
  const q = query(
    collection(db, 'orders'),
    where('passenger_phone', '==', phone),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllOrders() {
  const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeUserOrders(phone, cb) {
  const q = query(
    collection(db, 'orders'),
    where('passenger_phone', '==', phone),
    orderBy('created_at', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(list);
  });
}

export function subscribeAllOrders(cb) {
  const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(list);
  });
}

export async function updateDriverStatusByPhone(phone, status = 'idle') {
  const id = await findUserDocIdByPhone(phone);
  if (!id) throw new Error('找不到該司機帳戶');
  await updateDoc(doc(db, 'users', id), { status });
  return { phone, status };
}

export async function getDriverStats() {
  const q = query(collection(db, 'users'), where('role', '==', 'driver'));
  const snap = await getDocs(q);
  const drivers = snap.docs.map(d => d.data());
  const stats = {
    total: drivers.length,
    idle: drivers.filter(d => d.status === 'idle').length,
    busy: drivers.filter(d => d.status === 'busy').length,
    offline: drivers.filter(d => d.status === 'offline').length,
  };
  return { drivers, stats };
}

// 聊天訊息（行程內）
export async function sendOrderMessage(orderId, { from, to, role, text }) {
  const payload = { from, to, role, text, created_at: serverTimestamp() };
  const ref = await addDoc(collection(db, 'orders', orderId, 'messages'), payload);
  await updateDoc(ref, { id: ref.id });
  return { id: ref.id, ...payload };
}

export function subscribeOrderMessages(orderId, cb) {
  const q = query(collection(db, 'orders', orderId, 'messages'), orderBy('created_at', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(list);
  });
}

export default {
  createOrder,
  updateOrderStatus,
  getOrdersByPassenger,
  getAllOrders,
  subscribeUserOrders,
  subscribeAllOrders,
  updateDriverStatusByPhone,
  getDriverStats,
  sendOrderMessage,
  subscribeOrderMessages,
};