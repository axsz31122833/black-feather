import api from './api';
import invokeWithAuth from './functions';

class TaxiAPI {
  async updateDriverStatus({ phone, status }) {
    try { return await invokeWithAuth('driver-status', { phone, status }); }
    catch { const res = await api.post('/drivers/update-status', { phone, status }); return res.data; }
  }
  async updateRideStatus({ rideId, nextStatus, driverPhone, passengerPhone }) {
    const payload = { rideId, nextStatus, driverPhone, passengerPhone };
    try { return await invokeWithAuth('ride-status-update', payload); }
    catch { const res = await api.post('/rides/update-status', payload); return res.data; }
  }
  async submitOrderReview({ orderId, rating, comment, byPhone }) {
    try { return await invokeWithAuth('orders-review', { orderId, rating, comment, by_phone: byPhone }); }
    catch { const res = await api.post('/orders/review', { orderId, rating, comment, by_phone: byPhone }); return res.data; }
  }
  async getUserProfile(phone) {
    const encoded = encodeURIComponent(phone);
    const res = await api.get('/users/' + encoded);
    return res.data;
  }
  async requestRide({ passengerPhone, pickup, dropoff, remarks }) {
    const payload = { passengerPhone, pickup, dropoff, remarks };
    try { return await invokeWithAuth('ride-request', payload); }
    catch { const res = await api.post('/rides/request', payload); return res.data; }
  }
  async completeRide({ rideId, driverPhone }) {
    try { return await invokeWithAuth('rides-complete', { rideId, driverPhone }); }
    catch { const res = await api.post('/rides/complete', { rideId, driverPhone }); return res.data; }
  }
}
const taxiApi = new TaxiAPI();
export default taxiApi;
