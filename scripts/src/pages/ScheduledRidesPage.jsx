import React, { useState } from 'react';
import { supabase } from '../lib/rideApi';

export default function ScheduledRidesPage() {
  const [passengerId, setPassengerId] = useState('');
  const [time, setTime] = useState('');
  const [pickup, setPickup] = useState({ lat: 25.03, lng: 121.56 });
  const [dropoff, setDropoff] = useState({ lat: 25.04, lng: 121.57 });
  const [res, setRes] = useState(null);

  async function submit() {
    const scheduled_time = new Date(time).toISOString();
    const { data, error } = await supabase.from('scheduled_rides').insert({
      passenger_id: passengerId,
      scheduled_time,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      status: 'scheduled',
    }).select('*');
    setRes(error ? { error } : { data });
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>預約叫車</h2>
      <div>
        <label>Passenger ID: </label>
        <input value={passengerId} onChange={e => setPassengerId(e.target.value)} />
      </div>
      <div>
        <label>Scheduled Time (ISO or local parseable): </label>
        <input value={time} onChange={e => setTime(e.target.value)} />
      </div>
      <div>
        <label>Pickup (lat,lng): </label>
        <input type="number" step="0.000001" value={pickup.lat} onChange={e => setPickup({ ...pickup, lat: parseFloat(e.target.value) })} />
        <input type="number" step="0.000001" value={pickup.lng} onChange={e => setPickup({ ...pickup, lng: parseFloat(e.target.value) })} />
      </div>
      <div>
        <label>Dropoff (lat,lng): </label>
        <input type="number" step="0.000001" value={dropoff.lat} onChange={e => setDropoff({ ...dropoff, lat: parseFloat(e.target.value) })} />
        <input type="number" step="0.000001" value={dropoff.lng} onChange={e => setDropoff({ ...dropoff, lng: parseFloat(e.target.value) })} />
      </div>
      <button onClick={submit}>建立預約單</button>
      <pre>{res ? JSON.stringify(res, null, 2) : null}</pre>
    </div>
  );
}
