#!/usr/bin/env node
// Patch script: integrate frontend with Supabase Functions + Realtime
// - Writes .env keys (VITE_SUPABASE_URL/ANON_KEY/FUNCTIONS_URL/GOOGLE_MAPS_API_KEY)
// - Adds src/lib/rideApi.js with function callers and realtime helpers
// - Adds src/pages/ScheduledRidesPage.jsx (basic form to create scheduled ride)
// - Patches src/App.jsx to include ScheduledRidesPage route
// - Tries to import rideApi in src/pages/PassengerRidePage.jsx and bind a global tester function

const fs = require('fs');
const path = require('path');

// Use process.cwd() parent as project root to avoid path resolution issues in some environments
const projectRoot = path.resolve(process.cwd(), '..');
const srcDir = path.join(projectRoot, 'src');
const pagesDir = path.join(srcDir, 'pages');
const libDir = path.join(srcDir, 'lib');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function upsertEnv() {
  const envPath = path.join(projectRoot, '.env');
  const lines = [
    'VITE_SUPABASE_URL=https://hmlyfcpicjpjxayilyhk.supabase.co',
    'VITE_SUPABASE_ANON_KEY=sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j',
    'VITE_SUPABASE_FUNCTIONS_URL=https://hmlyfcpicjpjxayilyhk.supabase.co/functions/v1',
    'VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE',
  ];
  let existing = '';
  if (fs.existsSync(envPath)) existing = fs.readFileSync(envPath, 'utf8');
  const addLine = (key, line) => {
    const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=.*$', 'm');
    if (re.test(existing)) {
      existing = existing.replace(re, line);
    } else {
      existing = existing ? existing + '\n' + line : line;
    }
  };
  addLine('VITE_SUPABASE_URL', lines[0]);
  addLine('VITE_SUPABASE_ANON_KEY', lines[1]);
  addLine('VITE_SUPABASE_FUNCTIONS_URL', lines[2]);
  addLine('VITE_GOOGLE_MAPS_API_KEY', lines[3]);
  fs.writeFileSync(envPath, existing, 'utf8');
  return envPath;
}

function writeRideApi() {
  ensureDir(libDir);
  const filePath = path.join(libDir, 'rideApi.js');
  const content = `// Frontend API integrations for Supabase Functions + Realtime
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
export const supabase = createClient(supabaseUrl, supabaseAnon);

const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY; // use anon key in --no-verify-jwt mode

async function postFn(name, payload) {
  const res = await fetch(
    functionsUrl.replace(/\/$/, '') + '/' + name,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey,
      },
      body: JSON.stringify(payload),
    }
  );
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, text }; }
}

export async function requestRide(passengerId, origin, destination) {
  return postFn('request_ride', { passenger_id: passengerId, origin, destination });
}

export async function assignDriver(passengerId, origin) {
  return postFn('assign_driver', { passenger_id: passengerId, origin });
}

export async function updateDriverLocation(driverId, lat, lng) {
  return postFn('update_location', { driver_id: driverId, lat, lng });
}

export async function startRide(rideId) {
  return postFn('start_ride', { ride_id: rideId });
}

export async function finishRide(rideId, dropoff) {
  return postFn('finish_ride', { ride_id: rideId, dropoff });
}

export async function cancelRide(rideId, reason) {
  return postFn('cancel_ride', { ride_id: rideId, reason });
}

export function subscribeDriverRides(driverId, onChange) {
  const ch = supabase.channel('driver-channel-' + driverId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: 'driver_id=eq.' + driverId }, payload => {
      try { onChange?.(payload); } catch (e) { console.error('driver rides handler error', e); }
    })
    .subscribe();
  return ch;
}

export function subscribePassengerRides(passengerId, onChange) {
  const ch = supabase.channel('passenger-channel-' + passengerId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: 'passenger_id=eq.' + passengerId }, payload => {
      try { onChange?.(payload); } catch (e) { console.error('passenger rides handler error', e); }
    })
    .subscribe();
  return ch;
}

export function subscribeDriverLocations(onChange) {
  const ch = supabase.channel('locations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, payload => {
      try { onChange?.(payload); } catch (e) { console.error('loc handler error', e); }
    })
    .subscribe();
  return ch;
}
`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function writeScheduledPage() {
  ensureDir(pagesDir);
  const filePath = path.join(pagesDir, 'ScheduledRidesPage.jsx');
  const content = `import React, { useState } from 'react';
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
`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function patchAppRoutes() {
  const appPath = path.join(srcDir, 'App.jsx');
  if (!fs.existsSync(appPath)) {
    return { ok: false, message: 'src/App.jsx not found' };
  }
  let txt = fs.readFileSync(appPath, 'utf8');
  if (!/ScheduledRidesPage/.test(txt)) {
    txt = txt.replace(/(^\s*import[^\n]*$)/m, `$1\nimport ScheduledRidesPage from './pages/ScheduledRidesPage.jsx';`);
  }
  if (/<Routes>[\s\S]*<\/Routes>/.test(txt)) {
    txt = txt.replace(/<Routes>([\s\S]*?)<\/Routes>/, (m, inner) => {
      const routeLine = `\n        <Route path="/scheduled" element={<ScheduledRidesPage />} />`;
      if (/path=\"\/scheduled\"/.test(inner)) return m; // already present
      return `<Routes>${inner}${routeLine}\n      </Routes>`;
    });
  } else {
    // naive append
    txt += `\n{/* Added by patch-frontend-integration */}\nimport { Routes, Route } from 'react-router-dom';\n` +
      `\nfunction AppWithScheduledWrapper(){\n  return (<Routes>\n    <Route path="/scheduled" element={<ScheduledRidesPage/>} />\n  </Routes>);\n}\n`;
  }
  fs.writeFileSync(appPath, txt, 'utf8');
  return { ok: true };
}

function patchPassengerRidePage() {
  const pagePath = path.join(pagesDir, 'PassengerRidePage.jsx');
  if (!fs.existsSync(pagePath)) {
    return { ok: false, message: 'src/pages/PassengerRidePage.jsx not found' };
  }
  let txt = fs.readFileSync(pagePath, 'utf8');
  // add import
  if (!/from '..\/lib\/rideApi'/.test(txt)) {
    txt = txt.replace(/(^\s*import[^\n]*$)/m, `$1\nimport { requestRide as requestRideViaFn, subscribePassengerRides, subscribeDriverLocations } from '../lib/rideApi';`);
  }
  // add global helper for quick testing
  if (!/window\.requestRideViaEdge/.test(txt)) {
    txt += `\n\n// Added by patch-frontend-integration\nif (typeof window !== 'undefined') {\n  window.requestRideViaEdge = async function(passengerId, origin, destination){\n    const res = await requestRideViaFn(passengerId, origin, destination);\n    console.log('requestRideViaEdge result', res);\n    return res;\n  };\n}\n`;
  }
  fs.writeFileSync(pagePath, txt, 'utf8');
  return { ok: true };
}

function main(){
  ensureDir(srcDir);
  ensureDir(pagesDir);
  ensureDir(libDir);
  const envPath = upsertEnv();
  const rideApiPath = writeRideApi();
  const schedPath = writeScheduledPage();
  const appPatch = patchAppRoutes();
  const passPatch = patchPassengerRidePage();
  console.log(JSON.stringify({ envPath, rideApiPath, schedPath, appPatch, passPatch }, null, 2));
}

if (require.main === module) {
  main();
}