
let ws = null;
let connectedRole = null;
const listeners = new Map();

export function connectWs(role = 'passenger', url = (import.meta?.env?.VITE_WS_URL) ? import.meta.env.VITE_WS_URL : 'ws://localhost:3010') {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  ws = new WebSocket(`${url}?role=${role}`);
  connectedRole = role;
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { msg = { event: 'message', data: ev.data }; }
    const arr = listeners.get(msg.event);
    if (arr) arr.forEach(fn => {
      try { fn(msg.data); } catch (e) { console.error('ws listener error', e); }
    });
  };
  ws.onopen = () => console.log('[ws] connected as', role);
  ws.onclose = () => console.log('[ws] closed');
  ws.onerror = (e) => console.error('[ws] error', e);
  return ws;
}

export function on(event, fn) {
  const arr = listeners.get(event) || [];
  arr.push(fn);
  listeners.set(event, arr);
  return () => off(event, fn);
}

export function off(event, fn) {
  const arr = listeners.get(event) || [];
  listeners.set(event, arr.filter(x => x !== fn));
}

export function send(event, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify({ event, data }));
  return true;
}

export function getWs() { return ws; }
export function getRole() { return connectedRole; }
