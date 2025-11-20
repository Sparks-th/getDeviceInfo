/* getDeviceInfo — main script
   - Runs a set of feature detections and API probes
   - Renders a card per category
   - Shows "unknown" when detection fails or is unsupported
   - Runs while loader displays (loader is compulsory 7s)
*/

const CARDS_ROOT = document.getElementById('cards');
const REFRESH_BTN = document.getElementById('refreshBtn');
const YEAR_EL = document.getElementById('year');
if (YEAR_EL) YEAR_EL.textContent = new Date().getFullYear();

function mkCard(title, contentEl){
  const card = document.createElement('section');
  card.className = 'card';
  const h = document.createElement('h3');
  h.textContent = title;
  card.appendChild(h);
  if (typeof contentEl === 'string'){
    const p = document.createElement('p');
    p.textContent = contentEl || 'unknown';
    card.appendChild(p);
  } else {
    card.appendChild(contentEl);
  }
  return card;
}

function mkKV(key, val){
  const row = document.createElement('div');
  row.className = 'kv';
  const k = document.createElement('div');
  k.className = 'key';
  k.textContent = key;
  const v = document.createElement('div');
  v.className = 'val';
  v.textContent = (val === undefined || val === null || val === '') ? 'unknown' : String(val);
  row.appendChild(k); row.appendChild(v);
  return row;
}

function safe(fn, fallback = 'unknown'){
  try{
    const v = fn();
    if (v instanceof Promise) return v.then(r=> r ?? fallback).catch(()=>fallback);
    return v ?? fallback;
  } catch(e){ return fallback; }
}

async function gatherBasic(){
  const el = document.createElement('div');
  el.appendChild(mkKV('userAgent', navigator.userAgent || 'unknown'));
  el.appendChild(mkKV('userAgentData', safe(()=>navigator.userAgentData ? JSON.stringify({
    brands:navigator.userAgentData.brands,
    mobile:navigator.userAgentData.mobile,
    platform:navigator.userAgentData.platform
  }) : 'unsupported')));
  el.appendChild(mkKV('platform', navigator.platform || 'unknown'));
  el.appendChild(mkKV('language', navigator.language || 'unknown'));
  el.appendChild(mkKV('languages', (navigator.languages && navigator.languages.join(', ')) || 'unknown'));
  el.appendChild(mkKV('cookieEnabled', navigator.cookieEnabled));
  el.appendChild(mkKV('doNotTrack', navigator.doNotTrack || 'unknown'));
  el.appendChild(mkKV('vendor', navigator.vendor || 'unknown'));
  return mkCard('Browser & Locale', el);
}

async function gatherScreen(){
  const el = document.createElement('div');
  const s = window.screen || {};
  el.appendChild(mkKV('screenWxH', `${s.width || 'unknown'} x ${s.height || 'unknown'}`));
  el.appendChild(mkKV('availWxH', `${s.availWidth || 'unknown'} x ${s.availHeight || 'unknown'}`));
  el.appendChild(mkKV('colorDepth', s.colorDepth ?? 'unknown'));
  el.appendChild(mkKV('pixelRatio', window.devicePixelRatio ?? 'unknown'));
  el.appendChild(mkKV('viewportWxH', `${window.innerWidth} x ${window.innerHeight}`));
  if (screen.orientation) {
    el.appendChild(mkKV('orientation', `${screen.orientation.type || 'unknown'} @ ${screen.orientation.angle || 0}°`));
  }
  return mkCard('Display & Viewport', el);
}

async function gatherHardware(){
  const el = document.createElement('div');
  el.appendChild(mkKV('hardwareConcurrency', navigator.hardwareConcurrency ?? 'unknown'));
  el.appendChild(mkKV('deviceMemory', navigator.deviceMemory ?? 'unknown'));
  el.appendChild(mkKV('maxTouchPoints', navigator.maxTouchPoints ?? 'unknown'));
  // WebGL info
  try{
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      el.appendChild(mkKV('webgl', 'unsupported'));
    } else {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      el.appendChild(mkKV('webglVendor', vendor));
      el.appendChild(mkKV('webglRenderer', renderer));
    }
  }catch(e){
    el.appendChild(mkKV('webgl', 'unknown'));
  }
  return mkCard('Hardware Hints', el);
}

async function gatherBattery(){
  const el = document.createElement('div');
  if (navigator.getBattery){
    try{
      const b = await navigator.getBattery();
      el.appendChild(mkKV('charging', b.charging));
      el.appendChild(mkKV('level', b.level));
      el.appendChild(mkKV('chargingTime', b.chargingTime));
      el.appendChild(mkKV('dischargingTime', b.dischargingTime));
    }catch(e){ el.appendChild(mkKV('battery', 'unknown')); }
  } else {
    el.appendChild(mkKV('battery', 'unsupported'));
  }
  return mkCard('Battery', el);
}

async function gatherNetwork(){
  const el = document.createElement('div');
  const navConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  el.appendChild(mkKV('online', navigator.onLine));
  if (navConn){
    el.appendChild(mkKV('effectiveType', navConn.effectiveType ?? 'unknown'));
    el.appendChild(mkKV('downlink', navConn.downlink ?? 'unknown'));
    el.appendChild(mkKV('rtt', navConn.rtt ?? 'unknown'));
    el.appendChild(mkKV('saveData', navConn.saveData ?? 'unknown'));
  } else el.appendChild(mkKV('networkAPI', 'unsupported'));
  // IP is not directly available to JS without server — mark unknown
  el.appendChild(mkKV('publicIP', 'unknown (use server or STUN)'));
  return mkCard('Network', el);
}

async function gatherGeo(){
  const el = document.createElement('div');
  if (!('geolocation' in navigator)) {
    el.appendChild(mkKV('geolocation', 'unsupported'));
    return mkCard('Geolocation', el);
  }
  // try to query permission state first
  let permState = 'unknown';
  try{
    if (navigator.permissions && navigator.permissions.query){
      const p = await navigator.permissions.query({name:'geolocation'});
      permState = p.state;
    }
  }catch(e){ permState = 'unknown'; }
  el.appendChild(mkKV('permission', permState));
  if (permState === 'granted' || permState === 'prompt'){
    // attempt to get one position (may prompt)
    try{
      const pos = await new Promise((res, rej)=> {
        const t = setTimeout(()=> rej(new Error('timeout')), 8000);
        navigator.geolocation.getCurrentPosition((p)=>{ clearTimeout(t); res(p); }, (err)=>{ clearTimeout(t); rej(err); }, {maximumAge:60000, timeout:7000});
      });
      el.appendChild(mkKV('coords', `${pos.coords.latitude}, ${pos.coords.longitude}`));
      el.appendChild(mkKV('accuracy_m', pos.coords.accuracy));
      el.appendChild(mkKV('altitude', pos.coords.altitude ?? 'null'));
    }catch(e){
      el.appendChild(mkKV('coords', 'unknown or blocked'));
    }
  } else {
    el.appendChild(mkKV('coords', 'unknown (permission denied or prompt)'));
  }
  return mkCard('Geolocation', el);
}

async function gatherMediaDevices(){
  const el = document.createElement('div');
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices){
    el.appendChild(mkKV('mediaDevices', 'unsupported'));
    return mkCard('Media Devices', el);
  }
  try{
    const devices = await navigator.mediaDevices.enumerateDevices();
    el.appendChild(mkKV('count', devices.length));
    const byType = devices.reduce((acc,d)=>{
      acc[d.kind] = acc[d.kind] || 0; acc[d.kind]++; return acc;
    }, {});
    el.appendChild(mkKV('kinds', JSON.stringify(byType)));
    // labels are empty without permission in many browsers
    el.appendChild(mkKV('deviceLabelsAvailable', devices.some(d=>d.label && d.label.length>0)));
  }catch(e){
    el.appendChild(mkKV('mediaDevices', 'unknown'));
  }
  return mkCard('Media & Devices', el);
}

async function gatherPermissions(){
  const el = document.createElement('div');
  const names = ['geolocation','microphone','camera','notifications','persistent-storage','push','clipboard-read','clipboard-write','background-sync'];
  if (!navigator.permissions || !navigator.permissions.query){
    el.appendChild(mkKV('permissionsAPI', 'unsupported'));
    return mkCard('Permissions', el);
  }
  try{
    for (const name of names){
      try{
        // some names may throw
        // @ts-ignore
        const q = await navigator.permissions.query({name});
        el.appendChild(mkKV(name, q.state));
      }catch(e){
        el.appendChild(mkKV(name, 'unknown'));
      }
    }
  }catch(e){
    el.appendChild(mkKV('permissions', 'error'));
  }
  return mkCard('Permissions', el);
}

async function gatherPerformance(){
  const el = document.createElement('div');
  try{
    el.appendChild(mkKV('timeOrigin', performance.timeOrigin || performance.timing?.navigationStart || 'unknown'));
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav){
      el.appendChild(mkKV('domContentLoaded', nav.domContentLoadedEventEnd));
      el.appendChild(mkKV('loadEventEnd', nav.loadEventEnd));
    } else if (performance.timing){
      el.appendChild(mkKV('domContentLoaded', performance.timing.domContentLoadedEventEnd));
      el.appendChild(mkKV('loadEventEnd', performance.timing.loadEventEnd));
    }
    el.appendChild(mkKV('perfNow', performance.now()));
  }catch(e){ el.appendChild(mkKV('performance', 'unknown')); }
  return mkCard('Performance', el);
}

async function gatherSensors(){
  const el = document.createElement('div');
  // DeviceMotion / DeviceOrientation — may require user gesture & permission in modern browsers
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS 13+ style
    el.appendChild(mkKV('DeviceMotion API', 'requires gesture to request'));
    el.appendChild(mkKV('deviceMotionPermission', 'not-requested'));
  } else if (typeof DeviceMotionEvent !== 'undefined') {
    el.appendChild(mkKV('DeviceMotion API', 'available (may be restricted)'));
  } else {
    el.appendChild(mkKV('DeviceMotion API', 'unsupported'));
  }
  // Generic Sensor API detection
  el.appendChild(mkKV('GenericSensor', typeof window.Accelerometer !== 'undefined' ? 'available' : 'unsupported'));
  return mkCard('Sensors', el);
}

async function gatherCanvasAudioFingerprintingProbe(){
  const el = document.createElement('div');
  // Canvas
  try{
    const c = document.createElement('canvas');
    c.width = 250; c.height = 40;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = '#069';
    ctx.font = '16px "Arial"';
    ctx.fillText('getDeviceInfo — Dev Malvryx™', 2, 18);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('— fingerprint probe', 4, 35);
    const data = c.toDataURL();
    el.appendChild(mkKV('canvasProbe', data.slice(0,80) + '...'));
  }catch(e){
    el.appendChild(mkKV('canvasProbe', 'error'));
  }
  // AudioContext fingerprint-ish probe (non-invasive)
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx){
      const ctx = new AudioCtx();
      // do a short offline render to avoid auto-play restrictions
      if (ctx && typeof ctx.createOscillator === 'function'){
        const o = ctx.createOscillator();
        const dest = ctx.createGain();
        // avoid producing audible sound
        dest.gain.value = 0;
        o.connect(dest); dest.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 440;
        o.start(0);
        // stop quickly
        setTimeout(()=>{ try{o.stop()}catch(e){} try{ctx.close()}catch(e){} }, 60);
        el.appendChild(mkKV('audioContext', 'available'));
      } else {
        el.appendChild(mkKV('audioContext', 'limited'));
      }
    } else {
      el.appendChild(mkKV('audioContext', 'unsupported'));
    }
  }catch(e){ el.appendChild(mkKV('audioContext', 'error')); }
  return mkCard('Canvas / Audio Probes', el);
}

async function gatherWebAPIs(){
  const el = document.createElement('div');
  const features = [
    ['ServiceWorker', !!navigator.serviceWorker],
    ['localStorage', (()=>{ try{return !!localStorage}catch(e){return false}})()],
    ['IndexedDB', !!window.indexedDB],
    ['FileSystem Access', !!window.showOpenFilePicker],
    ['Clipboard (write)', !!(navigator.clipboard && navigator.clipboard.writeText)],
    ['Clipboard (read)', !!(navigator.clipboard && navigator.clipboard.readText)],
    ['WebBluetooth', !!navigator.bluetooth],
    ['WebUSB', !!navigator.usb],
    ['WebSerial', !!navigator.serial],
    ['WebHID', !!navigator.hid],
    ['Gamepad', !!navigator.getGamepads]
  ];
  for (const [k,v] of features) el.appendChild(mkKV(k, v));
  return mkCard('Web APIs', el);
}

async function gatherAll(){
  if (!CARDS_ROOT) return;
  CARDS_ROOT.innerHTML = '';
  const probes = [
    gatherBasic,
    gatherScreen,
    gatherHardware,
    gatherBattery,
    gatherNetwork,
    gatherGeo,
    gatherMediaDevices,
    gatherPermissions,
    gatherPerformance,
    gatherSensors,
    gatherCanvasAudioFingerprintingProbe,
    gatherWebAPIs
  ];
  for (const p of probes){
    try{
      const card = await p();
      CARDS_ROOT.appendChild(card);
    }catch(e){
      CARDS_ROOT.appendChild(mkCard('error', 'unknown'));
    }
  }
}

// show loader for exactly 7 seconds (compulsory) while we probe in background
async function initFlow(){
  const loader = document.getElementById('loader');
  // start gathering immediately
  const gatherPromise = gatherAll();
  // wait compulsory 7s
  const minWait = new Promise(res => setTimeout(res, 7000));
  await Promise.all([gatherPromise, minWait]);
  // hide loader, reveal content
  if (loader) loader.style.display = 'none';
  window.scrollTo({top:0,behavior:'smooth'});
}

// refresh handler
if (REFRESH_BTN){
  REFRESH_BTN.addEventListener('click', async ()=>{
    REFRESH_BTN.disabled = true;
    REFRESH_BTN.textContent = 'Refreshing…';
    await gatherAll();
    REFRESH_BTN.textContent = 'Refresh data';
    REFRESH_BTN.disabled = false;
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  initFlow().catch(()=>{ const l = document.getElementById('loader'); if (l) l.style.display='none'; });
});
